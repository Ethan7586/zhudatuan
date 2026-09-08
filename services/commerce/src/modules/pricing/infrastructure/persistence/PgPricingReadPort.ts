import { createHash } from 'node:crypto';
import type { CurrencyCode } from '@shop/kernel';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { boundedIdentifiers } from '../../../../platform/database/BoundedIdentifiers';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import { allParallel } from '@shop/kernel';
import type { EffectiveOffer, PricingReadPort, StorefrontPrice } from '../../public/PricingReadPort';
import { Offer } from '../../domain/model/Offer';
import { PriceBook, type PriceBookState } from '../../domain/model/PriceBook';
import { PricingRule, type PricingRuleKind, type PricingRuleState } from '../../domain/model/PricingRule';
import { PricingEngine } from '../../domain/service/PricingEngine';

interface PriceRow extends Record<string, unknown> {
  readonly id: string;
  readonly book_id: string;
  readonly sku: string;
  readonly scope: string;
  readonly amount_minor: number;
  readonly compare_minor: number | null;
  readonly currency: CurrencyCode;
  readonly version: number;
  readonly book_version: number;
  readonly book_name: string;
  readonly book_status: PriceBookState;
  readonly effective_at: Date | string;
  readonly expires_at: Date | string | null;
  readonly updated_at: Date | string;
}
interface RuleRow extends Record<string, unknown> {
  readonly id: string;
  readonly scope_id: string;
  readonly priority: number;
  readonly kind: PricingRuleKind;
  readonly condition: Readonly<Record<string, unknown>>;
  readonly effect: Readonly<Record<string, unknown>>;
  readonly version: number;
  readonly status: PricingRuleState;
  readonly effective_at: Date | string;
  readonly expires_at: Date | string | null;
  readonly approved_by: string;
}

export class PgPricingReadPort implements PricingReadPort {
  private readonly engine = new PricingEngine();
  constructor(private readonly transactions = new PgTransactionAccess()) {}
  async prices(context: ReadTransactionContext, mall: string, skus: readonly string[]): Promise<readonly StorefrontPrice[]> {
    const rows = await this.offers(context, mall, boundedIdentifiers(skus, 50, 'STOREFRONT_PRICING_SKUS_INVALID'));
    return Object.freeze(rows.map(({ sku, amountMinor, compareMinor, currency, version }) => Object.freeze({ sku, amountMinor, compareMinor, currency, version })));
  }

  async offers(context: ReadTransactionContext, scope: string, skus: readonly string[]): Promise<readonly EffectiveOffer[]> {
    return this.offersMany(context, [scope], boundedIdentifiers(skus, 200, 'PRICING_OFFER_SKUS_INVALID'));
  }

  async offersMany(context: ReadTransactionContext, scopes: readonly string[], skus: readonly string[]): Promise<readonly EffectiveOffer[]> {
    if (skus.length === 0 || scopes.length === 0) return Object.freeze([]);
    const selectedScopes = boundedIdentifiers(scopes, 50, 'PRICING_SCOPES_INVALID');
    const selectedSkus = boundedIdentifiers(skus, 200, 'PRICING_OFFER_SKUS_INVALID');
    const database = this.transactions.database(context);
    const [prices, rules] = await allParallel(
      [
        () =>
          database.query<PriceRow>(
            `select distinct on(book.scope_id,price.sku_id) price.id,price.book_id,price.sku_id sku,book.scope_id scope,
        price.amount_minor::float8 amount_minor,price.compare_minor::float8 compare_minor,book.currency,price.version::integer,
        book.version::integer book_version,book.name book_name,book.status book_status,price.effective_at,price.expires_at,price.updated_at
        from pricing.pricebook book join pricing.price price on price.book_id=book.id where book.scope_id=any($1::text[]) and book.status='active'
        and price.sku_id=any($2::text[]) and price.effective_at<=clock_timestamp()
        and (price.expires_at is null or price.expires_at>clock_timestamp())
        order by book.scope_id,price.sku_id,price.effective_at desc,price.version desc,price.id`,
            [selectedScopes, selectedSkus]
          ),
        () =>
          database.query<RuleRow>(
            `select id,scope_id,priority,kind,condition,effect,version,status,effective_at,expires_at,approved_by
         from pricing.rule where scope_id=any($1::text[]) and status='published' and effective_at<=clock_timestamp()
         and (expires_at is null or expires_at>clock_timestamp()) order by scope_id,priority,id limit 2001`,
            [selectedScopes]
          ),
      ] as const,
      { concurrency: 2, expiresAt: context.deadline, signal: context.signal }
    );
    if (rules.rows.length > 2000) throw new Error('PRICING_RULE_CAPACITY_EXCEEDED');
    const byScope = new Map<string, PricingRule[]>();
    for (const row of rules.rows) {
      const values = byScope.get(row.scope_id) ?? [];
      values.push(
        PricingRule.restore({
          id: row.id,
          scope: row.scope_id,
          priority: Number(row.priority),
          kind: row.kind,
          condition: row.condition,
          effect: row.effect,
          version: Number(row.version),
          state: row.status,
          effectiveAt: iso(row.effective_at),
          expiresAt: row.expires_at === null ? null : iso(row.expires_at),
          approvedBy: row.approved_by,
        })
      );
      byScope.set(row.scope_id, values);
    }
    const at = new Date();
    return Object.freeze(prices.rows.map((row) => offer(row, byScope.get(row.scope) ?? [], this.engine, at)));
  }
}

function offer(row: PriceRow, rules: readonly PricingRule[], engine: PricingEngine, at: Date): EffectiveOffer {
  const book = PriceBook.restore({ id: row.book_id, scope: row.scope, currency: row.currency, name: row.book_name, state: row.book_status, version: Number(row.book_version) }).snapshot();
  const source = Offer.create({
    id: row.id,
    book: book.id,
    sku: row.sku,
    amountMinor: Number(row.amount_minor),
    compareMinor: row.compare_minor === null ? null : Number(row.compare_minor),
    currency: book.currency,
    effectiveAt: iso(row.effective_at),
    expiresAt: row.expires_at === null ? null : iso(row.expires_at),
    version: Number(row.version),
    updatedAt: iso(row.updated_at),
  });
  const calculated = engine.price(source, rules, at);
  const effectiveAt = iso(row.effective_at);
  const watermark = [iso(row.updated_at), ...rules.map((rule) => rule.snapshot().effectiveAt)].sort().at(-1)!;
  const version = createHash('sha256')
    .update(JSON.stringify({ offer: row.id, version: row.version, rules: calculated.rules }))
    .digest('hex');
  return Object.freeze({
    sku: row.sku,
    scope: row.scope,
    sourceVersion: Number(row.version),
    amountMinor: calculated.amount.minor,
    compareMinor: calculated.compare?.minor ?? null,
    currency: row.currency,
    breakdown: calculated.breakdown,
    status: 'effective',
    effectiveAt,
    expiresAt: row.expires_at === null ? null : iso(row.expires_at),
    version,
    watermark,
  });
}

function iso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('PRICING_OFFER_TIME_INVALID');
  return date.toISOString();
}
