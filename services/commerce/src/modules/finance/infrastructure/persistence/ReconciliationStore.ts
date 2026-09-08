/** Finance reconciliation persistence. */
import { createHash } from 'node:crypto';
import type { TabularFilePort } from '../../../runtime/public';
import type { TransactionManager } from '../../../../platform/database/TransactionManager';
import { PgTransactionAccess, type SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { FinanceChannelPort } from '../../../channel/public';
import type { FinanceFulfillmentPort } from '../../../fulfillment/public';
import type { FinancePaymentPort } from '../../../payment/public';
import { PgRuntimeWriter, type RuntimeSql } from '../../../../platform/database/PgRuntimeWriter';
import { statementLine, type NormalizedStatementLine } from '../../domain/value/StatementLine';
import { Reconciliation } from '../../domain/model/Reconciliation';
import type { ReconciliationOutcome } from '../../application/port/ReconciliationProcess';
import { ReconciliationPolicy } from '../../domain/policy/ReconciliationPolicy';

export function transactionOptions(trace: string, scope: string, signal: AbortSignal, deadline: number) {
  return { tenant: scope, membership: '', scope, actor: 'job:reconciliation', trace, operation: 'job.finance.reconciliation', workload: 'jobs' as const, signal, deadline };
}

export async function match(database: Database, id: string, scope: string, matches: readonly ReconciliationMatch[]): Promise<void> {
  await database.query(
    `with external as(select record.reference,record.kind,record.id,record."amountMinor" from jsonb_to_recordset($3::jsonb)
      record(reference text,kind text,id text,"amountMinor" bigint)),candidates as(
      select line.id line_id,external.kind internal_type,external.id internal_id,external."amountMinor" internal_minor,1 priority
        from finance.statementline line join external on external.reference=line.external_reference and external.kind=line.kind
        where line.reconciliation_id=$1
      union all select line.id,'journal',journal.id,coalesce(sum(entry.amount_minor) filter(where entry.side='debit'),0),2
        from finance.statementline line join finance.journal journal on journal.reference_id=line.external_reference
        join finance.entry entry on entry.journal_id=journal.id where line.reconciliation_id=$1 and journal.scope_id=$2 group by line.id,journal.id),
    matched as(select distinct on(line_id) * from candidates order by line_id,priority,internal_id)
    insert into finance.reconciliationitem(id,reconciliation_id,statement_line_id,scope_id,internal_type,internal_id,external_minor,
      internal_minor,difference_minor,state,reason_code,evidence,version)
    select 'reconciliationitem:'||line.id,$1,line.id,$2,matched.internal_type,matched.internal_id,line.amount_minor,
      coalesce(matched.internal_minor,0),line.amount_minor-coalesce(matched.internal_minor,0),
      case when matched.internal_id is not null and line.amount_minor=matched.internal_minor then 'matched' else 'difference' end,
      case when matched.internal_id is null then 'INTERNAL_REFERENCE_MISSING' when line.amount_minor<>matched.internal_minor then 'AMOUNT_MISMATCH' end,
      jsonb_build_object('externalReference',line.external_reference,'kind',line.kind,'rawHash',line.raw_hash),0
    from finance.statementline line left join matched on matched.line_id=line.id where line.reconciliation_id=$1
    on conflict(statement_line_id) do update set internal_type=excluded.internal_type,internal_id=excluded.internal_id,
      internal_minor=excluded.internal_minor,difference_minor=excluded.difference_minor,state=excluded.state,reason_code=excluded.reason_code,
      evidence=excluded.evidence,version=finance.reconciliationitem.version+1`,
    [id, scope, JSON.stringify(matches)]
  );
}

export async function difference(database: Database, id: string, scope: string, amount: number, count: number): Promise<void> {
  const event = `event:${digest(`finance:reconciliation:${id}`)}`;
  await new PgRuntimeWriter(database as unknown as RuntimeSql).append({
    id: event,
    type: 'finance.reconciliation.difference',
    aggregateType: 'reconciliation',
    aggregate: id,
    scope,
    payload: { reconciliation: id, differenceMinor: amount, itemCount: count },
    trace: event,
  });
}

export interface Source {
  readonly scope_id: string;
  readonly provider: string;
  readonly partner_id: string;
  readonly period: string;
  readonly created_by: string;
  readonly statement_hash: string;
  readonly statement_ref: string;
  readonly reconciliation_debit: number | string;
  readonly reconciliation_credit: number | string;
  readonly reconciliation_difference: number | string;
  readonly version: number | string;
  readonly statement_id: string | null;
  readonly local_hash: string | null;
  readonly local_debit: number | string | null;
  readonly local_credit: number | string | null;
  readonly threshold_rule: unknown;
  readonly line_count: number;
}
export interface ReconciliationMatch {
  readonly reference: string;
  readonly kind: string;
  readonly id: string;
  readonly amountMinor: number;
}
export interface Database {
  query<R extends Record<string, unknown> = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<Readonly<{ rows: readonly R[]; rowCount?: number | null }>>;
}
export function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

export async function ingest(database: Database, files: TabularFilePort, reconciliation: string, scope: string, reference: string, sha256: string): Promise<void> {
  const seen = new Set<string>();
  let sequence = 0;
  for await (const batch of files.batches(reference, sha256)) {
    const values = batch.map((row) => {
      const line = statementLine(row, 'CNY');
      if (seen.has(line.reference)) throw new Error('FINANCE_IMPORT_REFERENCE_DUPLICATE');
      seen.add(line.reference);
      sequence += 1;
      return lineRecord(sequence, line, row);
    });
    const inserted = await database.query(
      `insert into finance.statementline(id,reconciliation_id,scope_id,sequence,external_reference,kind,amount_minor,
      tax_minor,currency,occurred_at,raw_hash) select 'statementline:'||substr(encode(public.digest($1||':'||record.sequence::text,'sha256'),'hex'),1,32),
      $1,$2,record.sequence,record.reference,record.kind,record.amount,record.tax,record.currency,record.occurred,record.hash
      from jsonb_to_recordset($3::jsonb) record(sequence integer,reference text,kind text,amount bigint,tax bigint,currency char(3),
        occurred timestamptz,hash char(64)) on conflict(reconciliation_id,sequence) do nothing returning id`,
      [reconciliation, scope, JSON.stringify(values)]
    );
    if ((inserted.rowCount ?? inserted.rows.length) !== values.length) throw new Error('STATEMENT_LINE_STAGE_CONFLICT');
  }
}

export function lineRecord(sequence: number, line: NormalizedStatementLine, source: Readonly<Record<string, string>>) {
  return Object.freeze({ sequence, reference: line.reference, kind: line.kind, amount: line.amount, tax: line.tax, currency: line.currency, occurred: line.occurred, hash: createHash('sha256').update(JSON.stringify(source)).digest('hex') });
}

export async function lineSummary(database: Database, reconciliation: string): Promise<Readonly<{ count: number; payments: number; refunds: number; references: string[] }>> {
  const result = await database.query<{ count: number | string; payments: number | string; refunds: number | string; references: unknown }>(
    `select count(*) count,
      coalesce(sum(amount_minor) filter(where kind='payment'),0) payments,
      coalesce(sum(amount_minor) filter(where kind='refund'),0) refunds,
      coalesce(array_agg(external_reference order by external_reference),'{}'::text[]) references
    from finance.statementline where reconciliation_id=$1`,
    [reconciliation]
  );
  const row = result.rows[0];
  const count = Number(row?.count ?? 0);
  const payments = Number(row?.payments ?? 0);
  const refunds = Number(row?.refunds ?? 0);
  const references = Array.isArray(row?.references) ? row.references.filter((value): value is string => typeof value === 'string' && value.length > 0) : [];
  if (![count, payments, refunds].every(Number.isSafeInteger) || count < 0 || payments < 0 || refunds < 0 || references.length !== count || new Set(references).size !== count) {
    throw new Error('STATEMENT_TOTAL_INVALID');
  }
  return Object.freeze({ count, payments, refunds, references });
}
