import type { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { FacetRepository, FinanceFacetCount, FinanceFacetSnapshot } from '../../application/port/FacetRepository';

interface FacetRow {
  readonly periods: unknown;
  readonly providers: unknown;
  readonly malls: unknown;
  readonly states: unknown;
  readonly differenceTypes: unknown;
  readonly watermark: Date | string | null;
}

export class PgFacetRepository implements FacetRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}

  async read(context: ReadTransactionContext, scopes: readonly string[]): Promise<FinanceFacetSnapshot> {
    const database = this.transactions.database(context);
    const result = await database.query<FacetRow>(
      `with scopedstatements as (
        select scope_id,period_start,period_end,generated_at from finance.statement where scope_id=any($1::text[])
      ), scopedreconciliations as (
        select id,scope_id,provider,state,updated_at from finance.reconciliation where scope_id=any($1::text[])
      )
      select
        (select coalesce(jsonb_agg(jsonb_build_object('value',value,'count',count) order by value desc),'[]'::jsonb)
          from (select period_start::text||'/'||period_end::text value,count(*) count from scopedstatements group by period_start,period_end) values) periods,
        (select coalesce(jsonb_agg(jsonb_build_object('value',provider,'count',count) order by count desc,provider),'[]'::jsonb)
          from (select provider,count(*) count from scopedreconciliations group by provider) values) providers,
        (select coalesce(jsonb_agg(jsonb_build_object('value',scope_id,'count',count) order by count desc,scope_id),'[]'::jsonb)
          from (select scope_id,count(*) count from (
            select scope_id from scopedstatements union all select scope_id from scopedreconciliations
          ) scoped group by scope_id) values) malls,
        (select coalesce(jsonb_agg(jsonb_build_object('value',state,'count',count) order by count desc,state),'[]'::jsonb)
          from (select state,count(*) count from scopedreconciliations group by state) values) states,
        (select coalesce(jsonb_agg(jsonb_build_object('value',reason_code,'count',count) order by count desc,reason_code),'[]'::jsonb)
          from (select item.reason_code,count(*) count from finance.reconciliationitem item
            join scopedreconciliations reconciliation on reconciliation.id=item.reconciliation_id
            where item.reason_code is not null group by item.reason_code) values) "differenceTypes",
        greatest(
          (select max(generated_at) from scopedstatements),
          (select max(updated_at) from scopedreconciliations)
        ) watermark`,
      [scopes]
    );
    const row = result.rows[0];
    if (!row) return emptySnapshot();
    return Object.freeze({
      periods: counts(row.periods),
      providers: counts(row.providers),
      malls: counts(row.malls),
      states: counts(row.states),
      differenceTypes: counts(row.differenceTypes),
      watermark: timestamp(row.watermark),
    });
  }
}

function counts(value: unknown): readonly FinanceFacetCount[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Readonly<Record<string, unknown>>;
    const count = typeof record.count === 'number' ? record.count : Number(record.count);
    return typeof record.value === 'string' && Number.isSafeInteger(count) && count >= 0
      ? [Object.freeze({ value: record.value, count })]
      : [];
  }));
}

function timestamp(value: Date | string | null): string | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function emptySnapshot(): FinanceFacetSnapshot {
  const empty = Object.freeze([]) as readonly FinanceFacetCount[];
  return Object.freeze({ periods: empty, providers: empty, malls: empty, states: empty, differenceTypes: empty, watermark: null });
}
