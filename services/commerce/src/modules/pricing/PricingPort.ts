import type { OperationDatabase } from '../../foundation/application/ModuleOperations';

export interface ProviderPrice {
  readonly id: string;
  readonly book: string;
  readonly sku: string;
  readonly amountMinor: number;
  readonly compareMinor: unknown;
  readonly effectiveAt: string;
  readonly expiresAt: unknown;
}

export class PricingPort {
  async offers(database: OperationDatabase, scope: string, skus: readonly string[]) {
    if (skus.length === 0) return Object.freeze([]);
    const result = await database.query<{ sku: string; amountMinor: number; currency: string; version: string }>(
      `select distinct on(price.sku_id) price.sku_id sku,price.amount_minor::float8 "amountMinor",
      book.currency,price.id version from pricing.pricebook book join pricing.price price on price.book_id=book.id
      where book.scope_id=$1 and book.status='active' and price.sku_id=any($2::text[])
      and price.effective_at<=clock_timestamp() and (price.expires_at is null or price.expires_at>clock_timestamp())
      order by price.sku_id,price.effective_at desc,book.id,price.id`,
      [scope, skus]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }

  async rules(database: OperationDatabase, scope: string) {
    const result = await database.query<{ id: string; version: number; priority: number; kind: string; condition: unknown; effect: unknown }>(
      `select id,version,priority,kind,condition,effect from pricing.rule where scope_id=$1 and status='published'
      and (effective_at is null or effective_at<=clock_timestamp()) order by priority,id`,
      [scope]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }

  async quote(database: OperationDatabase, quote: string, member: string, mall: string) {
    const result = await database.query<{ id: string; member: string; mall: string; payload: unknown; signature: string }>(
      `select id,member_id member,mall_id mall,signed_payload payload,signature from pricing.quote
      where id=$1 and member_id=$2 and mall_id=$3 and expires_at>clock_timestamp()`,
      [quote, member, mall]
    );
    const row = result.rows[0];
    if (!row) throw new Error('QUOTE_EXPIRED_OR_CONFLICT');
    return Object.freeze(row);
  }

  async prices(database: OperationDatabase, skus: readonly string[], scopes: readonly string[]): Promise<readonly Readonly<Record<string, unknown>>[]> {
    if (skus.length === 0 || scopes.length === 0) return Object.freeze([]);
    const result = await database.query(
      `select price.sku_id sku,book.scope_id scope,book.currency,price.amount_minor::text "amountMinor",
      case when price.compare_minor is null then null else price.compare_minor::text end "compareMinor",
      book.status "bookStatus",price.effective_at "effectiveAt",price.expires_at "expiresAt",book.version::text "bookVersion"
      from pricing.price price join pricing.pricebook book on book.id=price.book_id
      where price.sku_id=any($1::text[]) and book.scope_id=any($2::text[])
      order by book.scope_id,price.sku_id,price.effective_at desc`,
      [skus, scopes]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }

  async current(database: OperationDatabase, scope: string, sku: string): Promise<Readonly<{ amountMinor: number; currency: string; version: string }> | null> {
    const result = await database.query<{ id: string; amount_minor: number; currency: string }>(
      `select price.id,price.amount_minor::float8 amount_minor,book.currency from pricing.pricebook book
      join pricing.price price on price.book_id=book.id where book.scope_id=$1 and book.status='active' and price.sku_id=$2
      and price.effective_at<=clock_timestamp() and (price.expires_at is null or price.expires_at>clock_timestamp())
      order by price.effective_at desc,price.id limit 1`,
      [scope, sku]
    );
    const row = result.rows[0];
    return row ? Object.freeze({ amountMinor: row.amount_minor, currency: row.currency, version: row.id }) : null;
  }

  async currentMany(database: OperationDatabase, scope: string, skus: readonly string[]): Promise<ReadonlyMap<string, Readonly<{ amountMinor: number; currency: string; version: string }>>> {
    if (skus.length === 0) return new Map();
    const result = await database.query<{ sku_id: string; id: string; amount_minor: number; currency: string }>(
      `select distinct on(price.sku_id) price.sku_id,price.id,price.amount_minor::float8 amount_minor,book.currency
      from pricing.pricebook book join pricing.price price on price.book_id=book.id
      where book.scope_id=$1 and book.status='active' and price.sku_id=any($2::text[])
      and price.effective_at<=clock_timestamp() and (price.expires_at is null or price.expires_at>clock_timestamp())
      order by price.sku_id,price.effective_at desc,price.id`,
      [scope, skus]
    );
    return new Map(result.rows.map((row) => [row.sku_id, Object.freeze({ amountMinor: row.amount_minor, currency: row.currency, version: row.id })]));
  }

  async ensureProviderBook(database: OperationDatabase, id: string, scope: string, provider: string): Promise<void> {
    await database.query(
      `insert into pricing.pricebook(id,scope_id,currency,name,status,version) values($1,$2,'CNY',$3,'active',0)
      on conflict(scope_id,name) do update set status='active'`,
      [id, scope, `provider:${provider}`]
    );
  }

  async saveProviderPrice(database: OperationDatabase, input: ProviderPrice): Promise<void> {
    await database.query(
      `insert into pricing.price(id,book_id,sku_id,amount_minor,compare_minor,effective_at,expires_at)
      values($1,$2,$3,$4,$5,$6,$7) on conflict(book_id,sku_id,effective_at) do update
      set amount_minor=excluded.amount_minor,compare_minor=excluded.compare_minor,expires_at=excluded.expires_at`,
      [input.id, input.book, input.sku, input.amountMinor, input.compareMinor, input.effectiveAt, input.expiresAt]
    );
  }

  async saveQuote(
    database: OperationDatabase,
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
    await database.query(
      `insert into pricing.quote(id,member_id,mall_id,currency,subtotal_minor,discount_minor,payable_minor,lines,evidence_hash,
      dependencies,signed_payload,signature,expires_at,created_at) values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb,$11::jsonb,$12,$13,clock_timestamp())`,
      [
        input.id,
        input.member,
        input.mall,
        input.currency,
        input.subtotalMinor,
        input.discountMinor,
        input.payableMinor,
        JSON.stringify(input.lines),
        input.evidenceHash,
        JSON.stringify(input.evidence),
        JSON.stringify(input.payload),
        input.signature,
        input.expiresAt,
      ]
    );
  }

  async purgeQuotes(database: OperationDatabase, retained: readonly string[] = []): Promise<void> {
    await database.query(`delete from pricing.quote where expires_at<clock_timestamp()-interval '7 days' and not(id=any($1::text[]))`, [retained]);
  }
}
