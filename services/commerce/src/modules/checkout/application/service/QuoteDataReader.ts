import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { Money } from '@shop/kernel';
import { DomainError } from '../../../../platform/error/DomainError';
import { allParallel } from '@shop/kernel';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import type { BenefitChoice } from '../../../benefit/public';
import type { CheckoutQuote, QuoteLine, QuoteSnapshot } from '../../domain/model/CheckoutQuote';
import type { CheckoutSelection } from '../../domain/model/CheckoutSelection';
import { quoteConflict } from '../../domain/error/CheckoutError';
import { CheckoutPolicy } from '../../domain/policy/CheckoutPolicy';
import { allocateLineDiscount, quoteDigest, type CartRow, type LineRow, type PolicyRow, type PurchaseRow } from './QuoteCalculations';
import { QuoteDependencyCall, type QuoteControl } from './QuoteDependencyCall';
import { evaluateLine } from './QuoteLineFactory';
import { quoteRecordNumber as numeric, quoteRecordText as textual, type QuoteReaderDependencies, type QuoteVoucherChoice } from './QuoteReaderContext';

export { quoteDigest } from './QuoteCalculations';

export class QuoteDataReader {
  constructor(
    protected readonly dependencies: QuoteReaderDependencies,
    protected readonly policy = new CheckoutPolicy(),
    protected readonly calls = new QuoteDependencyCall()
  ) {}

  protected async cart(transaction: ReadTransactionContext, membership: string, selection: CheckoutSelection, control: QuoteControl): Promise<CartRow> {
    const owner = await this.calls.execute('member', control, () => this.dependencies.access.profile(transaction, membership));
    const cart = await this.calls.execute('cart', control, () => this.dependencies.cart.current(transaction, owner.member, owner.organization));
    const [profile, address, invoice, experience] = await allParallel(
      [
        () => this.calls.execute('qualification', control, () => this.dependencies.qualification.profile(transaction, owner.member, owner.organization)),
        () => this.calls.execute('member', control, () => this.dependencies.address.snapshot(transaction, selection.addressId, owner.member)),
        () => this.calls.execute('finance', control, () => this.dependencies.invoice.snapshot(transaction, selection.invoiceId, owner.member)),
        () => this.calls.execute('experience', control, () => this.dependencies.experience.published(transaction, cart.application)),
      ] as const,
      { concurrency: 4, expiresAt: control.expiresAt, signal: control.signal }
    );
    if (selection.addressId !== null && address === null) throw new DomainError('RESOURCE_NOT_FOUND');
    if (selection.invoiceId !== null && invoice === null) throw new DomainError('RESOURCE_NOT_FOUND');
    if (cart.version !== selection.cartVersion) return quoteConflict();
    const byListing = new Map(cart.items.map((line) => [line.listing, line]));
    const selected = selection.lines.map((line) => {
      const current = byListing.get(line.listingId);
      if (!current || !current.selected || current.quantity !== line.quantity || current.version !== line.lineVersion) return quoteConflict();
      return current;
    });
    return Object.freeze({
      id: cart.id,
      member_id: owner.member,
      mall_id: owner.organization,
      application_id: cart.application,
      version: cart.version,
      profile_status: owner.status,
      qualification_status: profile?.status ?? null,
      profile_version: profile?.version ?? null,
      city_code: profile?.city ?? null,
      address_version: numeric(address, 'version'),
      address_region: textual(address, 'regionCode'),
      address_snapshot: address,
      invoice_version: numeric(invoice, 'version'),
      invoice_snapshot: invoice,
      experience_version: experience?.version ?? null,
      experience_hash: experience?.hash ?? null,
      items: Object.freeze(selected),
    });
  }

  protected async lines(transaction: ReadTransactionContext, cart: CartRow, control: QuoteControl): Promise<readonly LineRow[]> {
    const listings = cart.items.map(({ listing }) => listing);
    const skus = cart.items.map(({ sku }) => sku);
    const [catalog, prices, stocks] = await allParallel(
      [
        () => this.calls.execute('catalog', control, () => this.dependencies.catalog.items(transaction, cart.mall_id, listings)),
        () => this.calls.execute('pricing', control, () => this.dependencies.pricing.offers(transaction, cart.mall_id, skus)),
        () => this.calls.execute('inventory', control, () => this.dependencies.inventory.availability(transaction, cart.mall_id, skus)),
      ] as const,
      { concurrency: 3, expiresAt: control.expiresAt, signal: control.signal }
    );
    const catalogByListing = new Map(catalog.map((item) => [item.listing, item]));
    const pricesBySku = new Map(prices.map((price) => [price.sku, price]));
    const stocksBySku = new Map(stocks.map((stock) => [stock.sku, stock]));
    return Object.freeze(
      cart.items.map((item) => {
        const rawCatalog = catalogByListing.get(item.listing);
        const product = rawCatalog?.sku === item.sku ? rawCatalog : undefined;
        const price = pricesBySku.get(item.sku);
        const stock = stocksBySku.get(item.sku);
        return Object.freeze({
          listing_id: item.listing,
          sku_id: item.sku,
          quantity: item.quantity,
          cart_line_version: item.version,
          listing_title: product?.title ?? null,
          listing_version: product?.listingVersion ?? null,
          listing_status: product?.listingStatus ?? null,
          product_id: product?.product ?? null,
          product_type: product?.productType ?? null,
          category_id: product?.category ?? null,
          product_version: product?.productVersion ?? null,
          sku_version: product?.skuVersion ?? null,
          unit_minor: price?.amountMinor ?? null,
          price_version: price?.version ?? null,
          price_breakdown: price?.breakdown ?? [],
          currency: price?.currency ?? null,
          stockitem_id: stock?.stockitem ?? null,
          onhand: stock?.onhand ?? null,
          safety: stock?.safety ?? null,
          reserved: stock?.reserved ?? null,
          stock_version: stock?.version ?? null,
          provider: product?.provider ?? null,
          partner_id: product?.partner ?? null,
        });
      })
    );
  }

  protected async policies(context: ReadTransactionContext, scope: string, control: QuoteControl): Promise<readonly PolicyRow[]> {
    const rows = await this.calls.execute('qualification', control, () => this.dependencies.qualification.policies(context, scope));
    return Object.freeze(rows.map((row) => Object.freeze({ ...row, version: row.policyVersion, rule_hash: row.hash, amount_minor: row.amountMinor })));
  }

  protected async purchases(context: ReadTransactionContext, member: string, control: QuoteControl): Promise<ReadonlyMap<string, PurchaseRow>> {
    const rows = await this.calls.execute('order', control, () => this.dependencies.orders.purchases(context, member));
    return new Map(
      rows.map((row) => [
        row.listing,
        Object.freeze({
          listing_id: row.listing,
          day_quantity: row.dayQuantity,
          week_quantity: row.weekQuantity,
          month_quantity: row.monthQuantity,
          lifetime_quantity: row.lifetimeQuantity,
          day_minor: row.dayMinor,
          week_minor: row.weekMinor,
          month_minor: row.monthMinor,
          lifetime_minor: row.lifetimeMinor,
        }),
      ])
    );
  }

  protected async tags(context: ReadTransactionContext, member: string, control: QuoteControl): Promise<ReadonlySet<string>> {
    return new Set(await this.calls.execute('qualification', control, () => this.dependencies.qualification.tags(context, member)));
  }

  protected async vouchers(context: ReadTransactionContext, cart: CartRow, selection: CheckoutSelection, control: QuoteControl): Promise<readonly QuoteVoucherChoice[]> {
    if (selection.voucherIds.length === 0) return [];
    const rows = await this.calls.execute('voucher', control, () => this.dependencies.voucher.preview(context, selection.voucherIds, cart.member_id, cart.mall_id));
    if (rows.length !== selection.voucherIds.length) throw new DomainError('VOUCHER_NOT_USABLE');
    return rows;
  }

  protected async benefits(context: ReadTransactionContext, cart: CartRow, selection: CheckoutSelection, control: QuoteControl): Promise<readonly BenefitChoice[]> {
    if (selection.benefits.length === 0) return [];
    const ids = selection.benefits.map(({ accountId }) => accountId);
    const rows = await this.calls.execute('benefit', control, () => this.dependencies.benefit.preview(context, cart.member_id, cart.mall_id, ids));
    if (rows.length !== ids.length || rows.some((row) => row.available_minor < selection.benefits.find(({ accountId }) => accountId === row.id)!.amountMinor)) throw new DomainError('BENEFIT_BALANCE_INSUFFICIENT');
    return rows;
  }
}
