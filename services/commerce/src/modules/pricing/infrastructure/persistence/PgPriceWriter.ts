import { randomUUID } from 'node:crypto';
import type { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import { DomainError } from '../../../../platform/error/DomainError';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';

interface PriceRow {
  readonly id: string;
  readonly sku_id: string;
  readonly amount_minor: number;
  readonly version: number;
  readonly effective_at: Date | string;
  readonly updated_at: Date | string;
}

export class PgPriceWriter {
  constructor(private readonly transactions: PgTransactionAccess) {}

  async set(context: WriteTransactionContext, input: Readonly<{ scope: string; sku: string; amountMinor: number; currency: 'CNY'; expectedVersion: number }>) {
    const database = this.transactions.database(context);
    await database.query(
      `insert into pricing.pricebook(id,scope_id,currency,name,status,version) values($1,$2,$3,'运营售价','active',1)
       on conflict(scope_id,name) do update set status='active'`,
      [`pricebook:operator:${input.scope}`, input.scope, input.currency]
    );
    const current = await database.query<{ id: string; version: number }>(
      `select price.id,price.version::integer from pricing.price price join pricing.pricebook book on book.id=price.book_id
       where book.scope_id=$1 and book.name='运营售价' and price.sku_id=$2 and price.effective_at<=clock_timestamp()
       and (price.expires_at is null or price.expires_at>clock_timestamp()) order by price.effective_at desc,price.version desc,price.id limit 1 for update of price`,
      [input.scope, input.sku]
    );
    const existing = current.rows[0];
    if ((existing === undefined && input.expectedVersion !== 0) || (existing !== undefined && existing.version !== input.expectedVersion)) throw new DomainError('VERSION_CONFLICT');
    const price = existing === undefined ? await this.create(context, input) : await this.update(context, input, existing.id);
    await new PgRuntimeWriter(database).append({
      id: `event:${randomUUID()}`,
      type: 'pricing.offer.changed',
      aggregateType: 'offer',
      aggregate: price.id,
      scope: input.scope,
      trace: context.trace,
      payload: { offer: price.id, sku: price.sku_id, scope: input.scope, version: price.version },
    });
    return Object.freeze({ sku: price.sku_id, scope: input.scope, amountMinor: Number(price.amount_minor), currency: input.currency, version: Number(price.version), effectiveAt: iso(price.effective_at), updatedAt: iso(price.updated_at) });
  }

  private async create(context: WriteTransactionContext, input: Readonly<{ scope: string; sku: string; amountMinor: number }>): Promise<PriceRow> {
    const result = await this.transactions.database(context).query<PriceRow>(
      `insert into pricing.price(id,book_id,sku_id,amount_minor,compare_minor,effective_at,expires_at,version,updated_at)
       values($1,(select id from pricing.pricebook where scope_id=$2 and name='运营售价'),$3,$4,null,clock_timestamp(),null,1,clock_timestamp())
       returning id,sku_id,amount_minor::float8 amount_minor,version::integer,effective_at,updated_at`,
      [`price:${randomUUID()}`, input.scope, input.sku, input.amountMinor]
    );
    const price = result.rows[0];
    if (!price) throw new DomainError('VERSION_CONFLICT');
    return price;
  }

  private async update(context: WriteTransactionContext, input: Readonly<{ amountMinor: number; expectedVersion: number }>, id: string): Promise<PriceRow> {
    const result = await this.transactions.database(context).query<PriceRow>(
      `update pricing.price set amount_minor=$2,version=version+1,updated_at=clock_timestamp() where id=$1 and version=$3
       returning id,sku_id,amount_minor::float8 amount_minor,version::integer,effective_at,updated_at`,
      [id, input.amountMinor, input.expectedVersion]
    );
    const price = result.rows[0];
    if (!price) throw new DomainError('VERSION_CONFLICT');
    return price;
  }
}

function iso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}
