import { Money } from '@shop/kernel';
import { DomainError } from '../../../foundation/domain/DomainError';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { allParallel } from '../../../foundation/performance/Parallel';
import type { MemberAccessPort } from '../../access/public';
import type { BenefitChoice, BenefitGateway } from '../../benefit/public';
import type { CartReadPort } from '../../cart/public';
import type { CheckoutCatalogPort } from '../../catalog/public';
import type { CheckoutExperiencePort } from '../../experience/public';
import type { CheckoutInvoicePort } from '../../finance/public';
import type { CheckoutInventoryPort } from '../../inventory/public';
import type { CheckoutMarketingPort } from '../../marketing/public';
import type { CheckoutOrderPort } from '../../order/public';
import type { CheckoutPricingPort } from '../../pricing/public';
import type { CheckoutQualificationPort } from '../../qualification/public';
import type { CheckoutQuote } from '../domain/model/CheckoutQuote';
import type { CheckoutSelection } from '../domain/model/CheckoutSelection';
import { quoteConflict } from '../domain/error/CheckoutError';
import { CheckoutPolicy } from '../domain/policy/CheckoutPolicy';
import type { CheckoutAddressSnapshotPort } from '../public';
import { allocateLineDiscount, campaignRule, quoteDigest, type CampaignRow, type CartRow, type LineRow, type PolicyRow, type PriceRuleRow, type PurchaseRow } from './QuotePolicySupport';
import { evaluateLine } from './QuoteLineFactory';

export { quoteDigest } from './QuotePolicySupport';

export interface QuoteVoucherChoice {
  readonly id: string;
  readonly remaining_minor: number;
  readonly version: number;
  readonly program: string;
}
export interface QuoteVoucherGateway {
  preview(database: OperationDatabase, vouchers: readonly string[], member: string, scope: string): Promise<readonly QuoteVoucherChoice[]>;
}
export interface QuoteReaderDependencies {
  readonly access: MemberAccessPort;
  readonly address: CheckoutAddressSnapshotPort;
  readonly benefit: Pick<BenefitGateway, 'preview'>;
  readonly cart: CartReadPort;
  readonly catalog: CheckoutCatalogPort;
  readonly experience: CheckoutExperiencePort;
  readonly invoice: CheckoutInvoicePort;
  readonly inventory: CheckoutInventoryPort;
  readonly marketing: CheckoutMarketingPort;
  readonly orders: CheckoutOrderPort;
  readonly pricing: CheckoutPricingPort;
  readonly qualification: CheckoutQualificationPort;
  readonly voucher: QuoteVoucherGateway;
}

export class QuoteReader {
  constructor(
    private readonly dependencies: QuoteReaderDependencies,
    private readonly policy = new CheckoutPolicy()
  ) {}

  async read(database: OperationDatabase, membership: string, selection: CheckoutSelection, context: Readonly<{ expiresAt: number; signal: AbortSignal }>): Promise<CheckoutQuote> {
    const cart = await this.cart(database, membership, selection, context);
    const [lines, policies, purchases, tags, campaigns, priceRules, vouchers, benefits] = await allParallel(
      [
        () => this.lines(database, cart, context),
        () => this.policies(database, cart.mall_id),
        () => this.purchases(database, cart.member_id),
        () => this.tags(database, cart.member_id),
        () => this.campaigns(database, cart.mall_id),
        () => this.priceRules(database, cart.mall_id),
        () => this.vouchers(database, cart, selection),
        () => this.benefits(database, cart, selection),
      ] as const,
      { concurrency: 4, ...context }
    );
    if (lines.length === 0) throw new DomainError('CART_EMPTY');
    const evaluated = lines.map((line) => evaluateLine(line, cart, policies, purchases, tags));
    const subtotal = evaluated.filter(({ accepted }) => accepted).reduce((sum, line) => sum.add(Money.of(line.totalMinor)), Money.zero());
    const promotion = this.policy.promotionDiscount(subtotal, campaigns.map(campaignRule));
    const priced = allocateLineDiscount(evaluated, promotion.amount, subtotal);
    const payable = subtotal.subtract(promotion.amount);
    const allocation = this.policy.allocateTenders(
      payable,
      vouchers.map(({ id, remaining_minor }) => ({ id, amount: Money.of(remaining_minor) })),
      benefits.map(({ id }) => ({ id, amount: Money.of(selection.benefits.find(({ accountId }) => accountId === id)!.amountMinor) }))
    );
    const evidence = Object.freeze({
      cart: { version: cart.version, lines: cart.items.map(({ listing, quantity, version }) => ({ listing, quantity, version })) },
      profile: { version: cart.profile_version, city: cart.city_code },
      address: selection.addressId === null ? null : { id: selection.addressId, version: cart.address_version, region: cart.address_region },
      invoice: selection.invoiceId === null ? null : { id: selection.invoiceId, version: cart.invoice_version },
      experience: { version: cart.experience_version, hash: cart.experience_hash },
      qualification: policies.map(({ id, version, rule_hash }) => ({ id, version, hash: rule_hash })),
      pricing: priceRules,
      marketing: promotion.evidence,
      vouchers: vouchers.map(({ id, version, program, remaining_minor }) => ({ id, version, program, remainingMinor: remaining_minor })),
      benefits: benefits.map(({ id, version, kind, available_minor }) => ({ id, version, kind, availableMinor: available_minor })),
    });
    return Object.freeze({
      cart: Object.freeze({ id: cart.id, member: cart.member_id, mall: cart.mall_id, application: cart.application_id, version: cart.version }),
      selection,
      lines: priced,
      subtotalMinor: subtotal.minor,
      discountMinor: promotion.amount.minor,
      payableMinor: payable.minor,
      personalMinor: allocation.personal.minor,
      currency: 'CNY',
      tenders: Object.freeze(allocation.tenders.map(({ kind, reference, amount }) => ({ kind, reference, amountMinor: amount.minor }))),
      evidence,
      rejections: Object.freeze(priced.filter(({ accepted }) => !accepted).map(({ listing, reasons }) => Object.freeze({ listing, reasons }))),
    });
  }

  private async cart(database: OperationDatabase, membership: string, selection: CheckoutSelection, context: Readonly<{ expiresAt: number; signal: AbortSignal }>): Promise<CartRow> {
    const owner = await this.dependencies.access.profile(database, membership);
    const cart = await this.dependencies.cart.current(database, owner.member, owner.organization);
    const [profile, address, invoice, experience] = await allParallel(
      [
        () => this.dependencies.qualification.profile(database, owner.member, owner.organization),
        () => this.dependencies.address.snapshot(database, selection.addressId, owner.member),
        () => this.dependencies.invoice.snapshot(database, selection.invoiceId, owner.member),
        () => this.dependencies.experience.published(database, cart.application),
      ] as const,
      { concurrency: 4, ...context }
    );
    if (selection.addressId !== null && address === null) throw new Error('CHECKOUT_ADDRESS_INVALID');
    if (selection.invoiceId !== null && invoice === null) throw new Error('CHECKOUT_INVOICE_INVALID');
    if (cart.version !== selection.cartVersion) return quoteConflict();
    const byListing = new Map(cart.items.map((line) => [line.listing, line]));
    const selected = selection.lines.map((line) => {
      const current = byListing.get(line.listingId);
      if (!current || current.quantity !== line.quantity || current.version !== line.lineVersion) return quoteConflict();
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
      address_region: textual(address, 'region_code'),
      invoice_version: numeric(invoice, 'version'),
      experience_version: experience?.version ?? null,
      experience_hash: experience?.hash ?? null,
      items: Object.freeze(selected),
    });
  }

  private async lines(database: OperationDatabase, cart: CartRow, context: Readonly<{ expiresAt: number; signal: AbortSignal }>): Promise<readonly LineRow[]> {
    const listings = cart.items.map(({ listing }) => listing);
    const skus = cart.items.map(({ sku }) => sku);
    const [catalog, prices, stocks] = await allParallel(
      [() => this.dependencies.catalog.items(database, cart.mall_id, listings), () => this.dependencies.pricing.offers(database, cart.mall_id, skus), () => this.dependencies.inventory.availability(database, cart.mall_id, skus)] as const,
      { concurrency: 4, ...context }
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
          cart_listing_version: item.listingVersion,
          cart_line_version: item.version,
          cart_price_version: item.priceVersion,
          cart_unit_minor: item.unitMinor,
          listing_title: product?.title ?? item.title,
          listing_version: product?.listingVersion ?? null,
          listing_status: product?.listingStatus ?? null,
          product_id: product?.product ?? null,
          product_type: product?.productType ?? null,
          category_id: product?.category ?? null,
          product_version: product?.productVersion ?? null,
          sku_version: product?.skuVersion ?? null,
          unit_minor: price?.amountMinor ?? null,
          price_version: price?.version ?? null,
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

  private async policies(database: OperationDatabase, scope: string): Promise<readonly PolicyRow[]> {
    return Object.freeze((await this.dependencies.qualification.policies(database, scope)).map((row) => Object.freeze({ ...row, rule_hash: row.hash, amount_minor: row.amountMinor })));
  }

  private async purchases(database: OperationDatabase, member: string): Promise<ReadonlyMap<string, PurchaseRow>> {
    const rows = await this.dependencies.orders.purchases(database, member);
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

  private async tags(database: OperationDatabase, member: string): Promise<ReadonlySet<string>> {
    return new Set(await this.dependencies.qualification.tags(database, member));
  }

  private async campaigns(database: OperationDatabase, scope: string): Promise<readonly CampaignRow[]> {
    return Object.freeze((await this.dependencies.marketing.campaigns(database, scope)).map((row) => Object.freeze({ id: row.id, version: row.version, rule: row.rule, remaining_budget: row.remainingBudget })));
  }

  private async priceRules(database: OperationDatabase, scope: string): Promise<readonly PriceRuleRow[]> {
    return this.dependencies.pricing.rules(database, scope);
  }

  private async vouchers(database: OperationDatabase, cart: CartRow, selection: CheckoutSelection): Promise<readonly QuoteVoucherChoice[]> {
    if (selection.voucherIds.length === 0) return [];
    const rows = await this.dependencies.voucher.preview(database, selection.voucherIds, cart.member_id, cart.mall_id);
    if (rows.length !== selection.voucherIds.length) throw new Error('VOUCHER_NOT_USABLE');
    return rows;
  }

  private async benefits(database: OperationDatabase, cart: CartRow, selection: CheckoutSelection): Promise<readonly BenefitChoice[]> {
    if (selection.benefits.length === 0) return [];
    const ids = selection.benefits.map(({ accountId }) => accountId);
    const rows = await this.dependencies.benefit.preview(database, cart.member_id, cart.mall_id, ids);
    if (rows.length !== ids.length || rows.some((row) => row.available_minor < selection.benefits.find(({ accountId }) => accountId === row.id)!.amountMinor)) {
      throw new DomainError('BENEFIT_BALANCE_INSUFFICIENT');
    }
    return rows;
  }
}

function numeric(value: unknown, key: string): number | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = (value as Readonly<Record<string, unknown>>)[key];
  return typeof result === 'number' && Number.isSafeInteger(result) ? result : null;
}

function textual(value: unknown, key: string): string | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = (value as Readonly<Record<string, unknown>>)[key];
  return typeof result === 'string' ? result : null;
}
