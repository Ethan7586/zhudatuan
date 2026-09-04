import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { Money } from '@shop/kernel';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { allParallel } from '../../../../foundation/performance/Parallel';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
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

export class QuoteReader {
  constructor(
    private readonly dependencies: QuoteReaderDependencies,
    private readonly policy = new CheckoutPolicy(),
    private readonly calls = new QuoteDependencyCall()
  ) {}

  async read(transaction: ReadTransactionContext, membership: string, selection: CheckoutSelection, control: QuoteControl): Promise<CheckoutQuote> {
    const cart = await this.cart(transaction, membership, selection, control);
    const [lines, policies, purchases, tags, vouchers, benefits] = await allParallel(
      [
        () => this.lines(transaction, cart, control),
        () => this.policies(transaction, cart.mall_id, control),
        () => this.purchases(transaction, cart.member_id, control),
        () => this.tags(transaction, cart.member_id, control),
        () => this.vouchers(transaction, cart, selection, control),
        () => this.benefits(transaction, cart, selection, control),
      ] as const,
      { concurrency: RUNTIME_LIMITS.checkout.parallelConcurrency, expiresAt: control.expiresAt, signal: control.signal }
    );
    if (lines.length === 0) throw new DomainError('CART_EMPTY');
    const evaluated = lines.map((line) => evaluateLine(line, cart, policies, purchases, tags));
    const acceptedLines = evaluated.filter(({ accepted }) => accepted);
    const subtotal = acceptedLines.reduce((sum, line) => sum.add(Money.of(line.totalMinor)), Money.zero());
    const promotion = await this.calls.execute('marketing', control, () => this.dependencies.marketing.evaluate(transaction, {
      scope: cart.mall_id,
      member: cart.member_id,
      channel: selection.paymentScene === 'miniapp' ? 'miniapp' : 'web',
      subtotalMinor: subtotal.minor,
      currency: 'CNY',
      productIds: unique(acceptedLines, 'product'),
      categoryIds: unique(acceptedLines, 'category'),
      listingIds: unique(acceptedLines, 'listing'),
      memberTags: Object.freeze([...tags]),
      qualificationStates: cart.qualification_status === null ? [] : [cart.qualification_status],
    }));
    const promotionAmount = Money.of(promotion.amountMinor);
    const priced = allocateLineDiscount(evaluated, promotionAmount, subtotal);
    const shipping = this.policy.shipping(selection, priced.some((line) => line.accepted && line.productType === 'physical'));
    const tax = this.policy.tax();
    const payable = this.policy.payable(subtotal, promotionAmount, Money.of(shipping.amountMinor), Money.of(tax.amountMinor));
    const allocation = this.policy.allocateTenders(
      payable,
      vouchers.map(({ id, remainingMinor }) => ({ id, amount: Money.of(remainingMinor) })),
      benefits.map(({ id }) => ({ id, amount: Money.of(selection.benefits.find(({ accountId }) => accountId === id)!.amountMinor) }))
    );
    const risk = await this.calls.execute('risk', control, () => this.dependencies.risk.evaluate(transaction, {
      actor: control.actor,
      operation: control.operation,
      resource: cart.id,
      scope: cart.mall_id,
      scopes: control.scopes,
      trace: control.trace,
      amountMinor: payable.minor,
      signals: Object.freeze({ checkoutlines: priced.length, checkouttenders: allocation.tenders.length }),
    }));
    assertRisk(risk);
    const address = versioned(cart.address_snapshot, cart.address_version);
    const invoice = versioned(cart.invoice_snapshot, cart.invoice_version);
    const evidence = Object.freeze({
      cart: { version: cart.version, lines: cart.items.map(({ listing, quantity, version }) => ({ listing, quantity, version })) },
      profile: { version: cart.profile_version, city: cart.city_code },
      address,
      invoice,
      experience: { version: cart.experience_version, hash: cart.experience_hash },
      catalog: lines.map(({ listing_id, listing_version, product_id, product_version, sku_id, sku_version }) => ({ listing: listing_id, listingVersion: listing_version, product: product_id, productVersion: product_version, sku: sku_id, skuVersion: sku_version })),
      qualification: policies.map(({ id, version, rule_hash }) => ({ id, version, hash: rule_hash })),
      pricing: lines.map(({ sku_id, unit_minor, price_version, price_breakdown }) => ({ sku: sku_id, amountMinor: unit_minor, version: price_version, breakdown: price_breakdown })),
      inventory: lines.map(({ sku_id, stockitem_id, onhand, safety, reserved, stock_version }) => ({ sku: sku_id, stockitem: stockitem_id, onhand, safety, reserved, version: stock_version })),
      marketing: promotion.evidence,
      vouchers: vouchers.map(({ id, version, product, remainingMinor }) => ({ id, version, product, remainingMinor })),
      benefits: benefits.map(({ id, version, kind, available_minor }) => ({ id, version, kind, availableMinor: available_minor })),
      shipping,
      tax,
      risk,
    });
    return Object.freeze({
      cart: Object.freeze({ id: cart.id, member: cart.member_id, mall: cart.mall_id, application: cart.application_id, version: cart.version }),
      selection,
      lines: priced,
      subtotalMinor: subtotal.minor,
      discountMinor: promotionAmount.minor,
      shippingMinor: shipping.amountMinor,
      taxMinor: tax.amountMinor,
      payableMinor: payable.minor,
      personalMinor: allocation.personal.minor,
      currency: 'CNY',
      tenders: Object.freeze(allocation.tenders.map(({ kind, reference, amount }) => ({ kind, reference, amountMinor: amount.minor }))),
      address,
      invoice,
      shipping,
      tax,
      evidence,
      rejections: Object.freeze(priced.filter(({ accepted }) => !accepted).map(({ listing, reasons }) => Object.freeze({ listing, reasons }))),
    });
  }

  private async cart(transaction: ReadTransactionContext, membership: string, selection: CheckoutSelection, control: QuoteControl): Promise<CartRow> {
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

  private async lines(transaction: ReadTransactionContext, cart: CartRow, control: QuoteControl): Promise<readonly LineRow[]> {
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
    return Object.freeze(cart.items.map((item) => {
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
    }));
  }

  private async policies(context: ReadTransactionContext, scope: string, control: QuoteControl): Promise<readonly PolicyRow[]> {
    const rows = await this.calls.execute('qualification', control, () => this.dependencies.qualification.policies(context, scope));
    return Object.freeze(rows.map((row) => Object.freeze({ ...row, version: row.policyVersion, rule_hash: row.hash, amount_minor: row.amountMinor })));
  }

  private async purchases(context: ReadTransactionContext, member: string, control: QuoteControl): Promise<ReadonlyMap<string, PurchaseRow>> {
    const rows = await this.calls.execute('order', control, () => this.dependencies.orders.purchases(context, member));
    return new Map(rows.map((row) => [row.listing, Object.freeze({ listing_id: row.listing, day_quantity: row.dayQuantity, week_quantity: row.weekQuantity, month_quantity: row.monthQuantity, lifetime_quantity: row.lifetimeQuantity, day_minor: row.dayMinor, week_minor: row.weekMinor, month_minor: row.monthMinor, lifetime_minor: row.lifetimeMinor })]));
  }

  private async tags(context: ReadTransactionContext, member: string, control: QuoteControl): Promise<ReadonlySet<string>> {
    return new Set(await this.calls.execute('qualification', control, () => this.dependencies.qualification.tags(context, member)));
  }

  private async vouchers(context: ReadTransactionContext, cart: CartRow, selection: CheckoutSelection, control: QuoteControl): Promise<readonly QuoteVoucherChoice[]> {
    if (selection.voucherIds.length === 0) return [];
    const rows = await this.calls.execute('voucher', control, () => this.dependencies.voucher.preview(context, selection.voucherIds, cart.member_id, cart.mall_id));
    if (rows.length !== selection.voucherIds.length) throw new DomainError('VOUCHER_NOT_USABLE');
    return rows;
  }

  private async benefits(context: ReadTransactionContext, cart: CartRow, selection: CheckoutSelection, control: QuoteControl): Promise<readonly BenefitChoice[]> {
    if (selection.benefits.length === 0) return [];
    const ids = selection.benefits.map(({ accountId }) => accountId);
    const rows = await this.calls.execute('benefit', control, () => this.dependencies.benefit.preview(context, cart.member_id, cart.mall_id, ids));
    if (rows.length !== ids.length || rows.some((row) => row.available_minor < selection.benefits.find(({ accountId }) => accountId === row.id)!.amountMinor)) throw new DomainError('BENEFIT_BALANCE_INSUFFICIENT');
    return rows;
  }
}

function unique(lines: readonly QuoteLine[], field: 'product' | 'category' | 'listing'): readonly string[] {
  return Object.freeze([...new Set(lines.map((line) => line[field]))]);
}

function versioned(value: unknown | null, version: number | null): QuoteSnapshot<unknown> | null {
  return value === null || version === null ? null : Object.freeze({ value, version: String(version), hash: quoteDigest(value) });
}

function assertRisk(risk: Readonly<{ outcome: 'allow' | 'challenge' | 'review' | 'deny'; safeReason: string; decision: string | null }>): void {
  if (risk.outcome === 'allow') return;
  const code = risk.outcome === 'challenge' ? 'STEPUP_REQUIRED' : risk.outcome === 'review' ? 'RISK_REVIEW_REQUIRED' : 'RISK_DENIED';
  throw new DomainError(code, { reason: risk.safeReason, decision: risk.decision });
}

export type { QuoteReaderDependencies, QuoteVoucherChoice, QuoteVoucherGateway } from './QuoteReaderContext';
