import { randomUUID } from 'node:crypto';
import { Money, type CurrencyCode } from '@shop/kernel';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ProviderPrice } from '../../public/ProviderPrice';
import { Offer } from '../../domain/model/Offer';
import { PriceBook } from '../../domain/model/PriceBook';
import { Quote } from '../../domain/model/Quote';
import { PricingEngine } from '../../domain/service/PricingEngine';
import { PgPricingReadPort } from './PgPricingReadPort';
import { PgPriceWriter } from './PgPriceWriter';
export class PricingPort {
  private readonly read: PgPricingReadPort;
  private readonly writer: PgPriceWriter;
  constructor(private readonly transactions = new PgTransactionAccess(), private readonly engine = new PricingEngine()) {
    this.read = new PgPricingReadPort(transactions);
    this.writer = new PgPriceWriter(transactions);
  }
  async offers(context: ReadTransactionContext, scope: string, skus: readonly string[]) {
    return this.read.offers(context, scope, skus);
  }
  async quote(context: ReadTransactionContext, quote: string, member: string, mall: string) {
    const database = this.transactions.database(context);
    const result = await database.query<{
      id: string;
      member_id: string;
      mall_id: string;
      currency: CurrencyCode;
      subtotal_minor: number;
      discount_minor: number;
      payable_minor: number;
      lines: readonly unknown[];
      evidence_hash: string;
      dependencies: Readonly<Record<string, unknown>>;
      signed_payload: Readonly<Record<string, unknown>>;
      signature: string;
      version: number;
      expires_at: Date | string;
      created_at: Date | string;
    }>(
      `select id,member_id,mall_id,currency,subtotal_minor::float8,discount_minor::float8,payable_minor::float8,lines,evidence_hash,
       dependencies,signed_payload,signature,version::integer,expires_at,created_at from pricing.quote where id=$1`,
      [quote]
    );
    const row = result.rows[0];
    if (!row) throw new DomainError('PRICE_QUOTE_EXPIRED');
    const snapshot = Quote.restore({
      id: row.id,
      member: row.member_id,
      mall: row.mall_id,
      currency: row.currency,
      subtotal: Money.of(Number(row.subtotal_minor), row.currency),
      discount: Money.of(Number(row.discount_minor), row.currency),
      payable: Money.of(Number(row.payable_minor), row.currency),
      lines: row.lines,
      evidenceHash: row.evidence_hash,
      dependencies: row.dependencies,
      payload: row.signed_payload,
      signature: row.signature,
      version: Number(row.version),
      expiresAt: iso(row.expires_at),
      createdAt: iso(row.created_at),
    }).use(member, mall, new Date());
    return Object.freeze({ id: snapshot.id, member: snapshot.member, mall: snapshot.mall, payload: snapshot.payload, signature: snapshot.signature });
  }
  async prices(context: ReadTransactionContext, skus: readonly string[], scopes: readonly string[]): Promise<readonly Readonly<Record<string, unknown>>[]> {
    const offers = await this.read.offersMany(context, scopes, skus);
    return Object.freeze(
      offers.map((offer) =>
        Object.freeze({
          sku: offer.sku,
          scope: offer.scope,
          currency: offer.currency,
          amountMinor: String(offer.amountMinor),
          compareMinor: offer.compareMinor === null ? null : String(offer.compareMinor),
          bookStatus: 'active',
          effectiveAt: offer.effectiveAt,
          expiresAt: offer.expiresAt,
          bookVersion: offer.version,
          priceVersion: offer.sourceVersion,
        })
      )
    );
  }
  async setPrice(context: WriteTransactionContext, input: Readonly<{ scope: string; sku: string; amountMinor: number; currency: 'CNY'; expectedVersion: number }>) { return this.writer.set(context, input); }
  async current(
    context: WriteTransactionContext,
    scope: string,
    sku: string
  ): Promise<Readonly<{
    amountMinor: number;
    currency: string;
    version: string;
  }> | null> {
    const offer = (await this.read.offers(context, scope, [sku]))[0];
    return offer ? Object.freeze({ amountMinor: offer.amountMinor, currency: offer.currency, version: offer.version }) : null;
  }
  async currentMany(
    context: ReadTransactionContext,
    scope: string,
    skus: readonly string[]
  ): Promise<
    ReadonlyMap<
      string,
      Readonly<{
        amountMinor: number;
        currency: string;
        version: string;
      }>
    >
  > {
    const offers = await this.read.offers(context, scope, skus);
    return new Map(offers.map((offer) => [offer.sku, Object.freeze({ amountMinor: offer.amountMinor, currency: offer.currency, version: offer.version })]));
  }
  async ensureProviderBook(context: WriteTransactionContext, id: string, scope: string, provider: string): Promise<void> {
    const book = PriceBook.create({ id, scope, currency: 'CNY', name: `provider:${provider}` }).snapshot();
    await this.transactions.database(context).query(
      `insert into pricing.pricebook(id,scope_id,currency,name,status,version) values($1,$2,$3,$4,$5,$6)
      on conflict(scope_id,name) do update set status='active',version=case when pricing.pricebook.status='active' then pricing.pricebook.version else pricing.pricebook.version+1 end`,
      [book.id, book.scope, book.currency, book.name, book.state, book.version]
    );
  }
  async saveProviderPrice(context: WriteTransactionContext, input: ProviderPrice): Promise<void> {
    const database = this.transactions.database(context);
    const offer = Offer.create({
      id: input.id,
      book: input.book,
      sku: input.sku,
      amountMinor: input.amountMinor,
      compareMinor: nullableMinor(input.compareMinor),
      currency: 'CNY',
      effectiveAt: input.effectiveAt,
      expiresAt: nullableTime(input.expiresAt),
      updatedAt: new Date().toISOString(),
    }).snapshot();
    const result = await database.query<{ id: string; book_id: string; sku_id: string; scope_id: string; version: number; changed: boolean }>(
      `with changed as(
        insert into pricing.price(id,book_id,sku_id,amount_minor,compare_minor,effective_at,expires_at,version,updated_at)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(book_id,sku_id,effective_at) do update
        set amount_minor=excluded.amount_minor,compare_minor=excluded.compare_minor,expires_at=excluded.expires_at
        where (pricing.price.amount_minor,pricing.price.compare_minor,pricing.price.expires_at)
          is distinct from (excluded.amount_minor,excluded.compare_minor,excluded.expires_at)
        returning id,book_id,sku_id,version)
       select changed.id,changed.book_id,changed.sku_id,book.scope_id,changed.version::integer,true changed
       from changed join pricing.pricebook book on book.id=changed.book_id
       union all select current.id,current.book_id,current.sku_id,book.scope_id,current.version::integer,false
       from pricing.price current join pricing.pricebook book on book.id=current.book_id
       where current.book_id=$2 and current.sku_id=$3 and current.effective_at=$6 and not exists(select 1 from changed)`,
      [offer.id, offer.book, offer.sku, offer.amount.minor, offer.compare?.minor ?? null, offer.effectiveAt, offer.expiresAt, offer.version, offer.updatedAt]
    );
    const changed = result.rows[0];
    if (!changed) throw new Error('PRICING_OFFER_SAVE_FAILED');
    if (changed.changed)
      await new PgRuntimeWriter(database).append({
        id: `event:${randomUUID()}`,
        type: 'pricing.offer.changed',
        aggregateType: 'offer',
        aggregate: changed.id,
        scope: changed.scope_id,
        trace: context.trace,
        payload: { offer: changed.id, book: changed.book_id, sku: changed.sku_id, scope: changed.scope_id, version: changed.version },
      });
  }
  async saveQuote(
    context: WriteTransactionContext,
    input: Readonly<{
      id: string;
      member: string;
      mall: string;
      currency: string;
      subtotalMinor: number;
      discountMinor: number;
      payableMinor: number;
      lines: unknown;
      evidenceHash: string;
      evidence: unknown;
      payload: unknown;
      signature: string;
      expiresAt: string;
    }>
  ): Promise<void> {
    const database = this.transactions.database(context);
    const quote = Quote.create({
      id: input.id,
      member: input.member,
      mall: input.mall,
      currency: input.currency as CurrencyCode,
      subtotalMinor: input.subtotalMinor,
      discountMinor: input.discountMinor,
      payableMinor: input.payableMinor,
      lines: array(input.lines),
      evidenceHash: input.evidenceHash,
      dependencies: object(input.evidence),
      payload: object(input.payload),
      signature: input.signature,
      expiresAt: input.expiresAt,
      createdAt: new Date().toISOString(),
    }).snapshot();
    await database.query(
      `insert into pricing.quote(id,member_id,mall_id,currency,subtotal_minor,discount_minor,payable_minor,lines,evidence_hash,
      dependencies,signed_payload,signature,version,expires_at,created_at) values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb,$11::jsonb,$12,$13,$14,$15)`,
      [
        quote.id,
        quote.member,
        quote.mall,
        quote.currency,
        quote.subtotal.minor,
        quote.discount.minor,
        quote.payable.minor,
        JSON.stringify(quote.lines),
        quote.evidenceHash,
        JSON.stringify(quote.dependencies),
        JSON.stringify(quote.payload),
        quote.signature,
        quote.version,
        quote.expiresAt,
        quote.createdAt,
      ]
    );
  }
  async purgeQuotes(context: WriteTransactionContext, retained: readonly string[] = []): Promise<void> {
    const database = this.transactions.database(context);
    await database.query(`delete from pricing.quote where expires_at<clock_timestamp()-interval '7 days' and not(id=any($1::text[]))`, [retained]);
  }
}

function nullableMinor(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error('PROVIDER_PRICE_INVALID');
  return Number(value);
}
function nullableTime(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new Error('PROVIDER_PRICE_TIME_INVALID');
  return value;
}
function array(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error('PRICING_QUOTE_LINES_INVALID');
  return Object.freeze([...value]);
}
function object(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('PRICING_QUOTE_OBJECT_INVALID');
  return Object.freeze({ ...(value as Record<string, unknown>) });
}
function iso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}
