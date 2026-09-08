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

import { QuoteDataReader } from './QuoteDataReader';
export class QuoteReader extends QuoteDataReader {
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
    const promotion = await this.calls.execute('marketing', control, () =>
      this.dependencies.marketing.evaluate(transaction, {
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
      })
    );
    const promotionAmount = Money.of(promotion.amountMinor);
    const priced = allocateLineDiscount(evaluated, promotionAmount, subtotal);
    const shipping = this.policy.shipping(
      selection,
      priced.some((line) => line.accepted && line.productType === 'physical')
    );
    const tax = this.policy.tax();
    const payable = this.policy.payable(subtotal, promotionAmount, Money.of(shipping.amountMinor), Money.of(tax.amountMinor));
    const allocation = this.policy.allocateTenders(
      payable,
      vouchers.map(({ id, remainingMinor }) => ({ id, amount: Money.of(remainingMinor) })),
      benefits.map(({ id }) => ({ id, amount: Money.of(selection.benefits.find(({ accountId }) => accountId === id)!.amountMinor) }))
    );
    const risk = await this.calls.execute('risk', control, () =>
      this.dependencies.risk.evaluate(transaction, {
        actor: control.actor,
        operation: control.operation,
        resource: cart.id,
        scope: cart.mall_id,
        scopes: control.scopes,
        trace: control.trace,
        amountMinor: payable.minor,
        signals: Object.freeze({ checkoutlines: priced.length, checkouttenders: allocation.tenders.length }),
      })
    );
    assertRisk(risk);
    const address = versioned(cart.address_snapshot, cart.address_version);
    const invoice = versioned(cart.invoice_snapshot, cart.invoice_version);
    const evidence = Object.freeze({
      cart: { version: cart.version, lines: cart.items.map(({ listing, quantity, version }) => ({ listing, quantity, version })) },
      profile: { version: cart.profile_version, city: cart.city_code },
      address,
      invoice,
      experience: { version: cart.experience_version, hash: cart.experience_hash },
      catalog: lines.map(({ listing_id, listing_version, product_id, product_version, sku_id, sku_version }) => ({
        listing: listing_id,
        listingVersion: listing_version,
        product: product_id,
        productVersion: product_version,
        sku: sku_id,
        skuVersion: sku_version,
      })),
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
