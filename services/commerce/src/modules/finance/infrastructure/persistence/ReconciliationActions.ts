/** Finance reconciliation persistence. */
import { createHash } from 'node:crypto';
import type { TabularFilePort } from '../../../runtime/public';
import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';
import { PgTransactionAccess, type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { FinanceChannelPort } from '../../../channel/public';
import type { FinanceFulfillmentPort } from '../../../fulfillment/public';
import type { FinancePaymentPort } from '../../../payment/public';
import { PgRuntimeWriter, type RuntimeSql } from '../../../../adapter/database/PgRuntimeWriter';
import { statementLine, type NormalizedStatementLine } from '../../domain/value/StatementLine';
import { Reconciliation } from '../../domain/model/Reconciliation';
import type { ReconciliationOutcome } from '../../application/port/ReconciliationProcess';
import { ReconciliationPolicy } from '../../domain/policy/ReconciliationPolicy';

export class ReconcileStatement {
  private readonly access = new PgTransactionAccess();
  private readonly policy = new ReconciliationPolicy();
  constructor(
    private readonly transactions: TransactionManager,
    private readonly files: TabularFilePort,
    private readonly channel: FinanceChannelPort,
    private readonly payments: FinancePaymentPort,
    private readonly fulfillments: FinanceFulfillmentPort
  ) {}

  async execute(id: string, scope: string, signal: AbortSignal, deadline: number): Promise<ReconciliationOutcome> {
    const options = transactionOptions(id, scope, signal, deadline);
    const prepared = await this.transactions.read(options, async (context) => {
      const database = this.access.database(context);
      const loaded = await database.query<Source>(
        `select target.scope_id,target.provider,target.partner_id,target.period,target.created_by,target.statement_hash,target.statement_ref,
          target.debit_minor::float8 reconciliation_debit,target.credit_minor::float8 reconciliation_credit,
          target.difference_minor::float8 reconciliation_difference,target.version::float8 version,statement.id statement_id,
          statement.sha256 local_hash,
          statement.debit_minor local_debit,statement.credit_minor local_credit,
          (select policy.rule from finance.policy policy where policy.scope_id=target.scope_id and policy.kind='threshold'
            and policy.state='active' order by policy.version desc,policy.id limit 1) threshold_rule,
          (select count(*)::integer from finance.statementline line where line.reconciliation_id=target.id) line_count
         from finance.reconciliation target left join finance.statement statement on statement.id=target.evidence->>'statementId'
         where target.id=$1 and target.state in('received','matching','difference')`,
        [id]
      );
      const source = loaded.rows[0];
      if (!source) throw new Error('RECONCILIATION_NOT_RUNNABLE');
      if (source.line_count > 0) {
        if (!source.statement_id || source.local_hash !== source.statement_hash) throw new Error('STATEMENT_INTEGRITY_FAILED');
        return Object.freeze({ source, statement: null });
      }
      const statement = await this.channel.statement(context, source.statement_ref, source.scope_id);
      if (!statement || statement.sha256 !== source.statement_hash) throw new Error('STATEMENT_INTEGRITY_FAILED');
      return Object.freeze({ source, statement });
    });
    const { source, statement } = prepared;
    await this.transactions.write(options, async (context) => {
      const claimed = await this.access.database(context).query(
        `update finance.reconciliation set state='matching',updated_at=clock_timestamp()
      where id=$1 and state in('received','matching','difference') returning id`,
        [id]
      );
      if (!claimed.rows[0]) throw new Error('RECONCILIATION_NOT_RUNNABLE');
    });
    return this.transactions.write(options, async (context) => {
      const client = this.access.database(context);
      if (statement) await ingest(client, this.files, id, source.scope_id, statement.objectRef, source.statement_hash);
      const lines = await lineSummary(client, id);
      if (lines.count < 1) throw new Error('STATEMENT_FILE_EMPTY');
      if (source.local_debit !== null && source.local_credit !== null
        && (Number(source.local_debit) !== lines.payments || Number(source.local_credit) !== lines.refunds)) throw new Error('STATEMENT_TOTAL_MISMATCH');
      const references = Object.freeze(lines.references);
      const [payments, fulfillments] = await Promise.all([this.payments.reconciliation(context, references), this.fulfillments.reconciliation(context, references)]);
      await match(client, id, source.scope_id, Object.freeze([...payments, ...fulfillments]));
      const internal = await client.query<{ net: number; differences: number; maximum: number }>(
        `select coalesce(sum(case line.kind when 'refund' then
          -item.internal_minor when 'fee' then -item.internal_minor else item.internal_minor end),0)::float8 net,
        count(*) filter(where item.state='difference')::integer differences,
        coalesce(max(abs(item.difference_minor)) filter(where item.state='difference'),0)::float8 maximum from finance.reconciliationitem item
        join finance.statementline line on line.id=item.statement_line_id where item.reconciliation_id=$1`,
        [id]
      );
      const summary = internal.rows[0]!;
      const providerNet = lines.payments - lines.refunds;
      const completed = Reconciliation.restore({
        id,
        scopeId: source.scope_id,
        provider: source.provider,
        partnerId: source.partner_id,
        period: source.period,
        statementRef: source.statement_ref,
        statementHash: source.statement_hash,
        state: 'matching',
        externalMinor: Number(source.reconciliation_debit),
        internalMinor: Number(source.reconciliation_credit),
        differenceMinor: Number(source.reconciliation_difference),
        differenceCount: 0,
        requestedBy: source.created_by,
        approvedBy: null,
        version: Number(source.version),
      }).complete(providerNet, summary.net, summary.differences).snapshot();
      const result = await client.query(
        `update finance.reconciliation set debit_minor=$2,credit_minor=$3,difference_minor=$4,
        evidence=$5::jsonb,state=$6,updated_at=clock_timestamp(),
        version=version+1 where id=$1 and state='matching' and version=$7 returning *`,
        [id, completed.externalMinor, completed.internalMinor, completed.differenceMinor,
          JSON.stringify({ rowCount: lines.count, provider: { payments: lines.payments, refunds: lines.refunds }, internalNet: summary.net, differences: summary.differences, maximumDifferenceMinor: summary.maximum, statementHash: source.statement_hash }), completed.state, Number(source.version)]
      );
      if (!result.rows[0]) throw new Error('RECONCILIATION_NOT_RUNNABLE');
      if (completed.state === 'difference') await difference(client, id, source.scope_id, completed.differenceMinor, summary.differences);
      if (completed.state !== 'balanced' && completed.state !== 'difference') throw new Error('RECONCILIATION_RESULT_INVALID');
      return Object.freeze({
        id,
        scopeId: source.scope_id,
        makerId: source.created_by,
        statementHash: source.statement_hash,
        externalMinor: completed.externalMinor,
        internalMinor: completed.internalMinor,
        differenceMinor: completed.differenceMinor,
        differenceCount: summary.differences,
        maximumDifferenceMinor: Number(summary.maximum),
        thresholdMinor: this.policy.threshold(source.threshold_rule ?? { amountMinor: 0 }),
        version: completed.version,
        state: completed.state,
      });
    });
  }
}

function transactionOptions(trace: string, scope: string, signal: AbortSignal, deadline: number) {
  return { tenant: scope, membership: '', scope, actor: 'job:reconciliation', trace, operation: 'job.finance.reconciliation', workload: 'jobs' as const, signal, deadline };
}

async function match(database: Database, id: string, scope: string, matches: readonly ReconciliationMatch[]): Promise<void> {
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

async function difference(database: Database, id: string, scope: string, amount: number, count: number): Promise<void> {
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

interface Source {
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
interface ReconciliationMatch {
  readonly reference: string;
  readonly kind: string;
  readonly id: string;
  readonly amountMinor: number;
}
interface Database {
  query<R extends Record<string, unknown> = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<Readonly<{ rows: readonly R[]; rowCount?: number | null }>>;
}
function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}


async function ingest(database: Database, files: TabularFilePort, reconciliation: string, scope: string, reference: string, sha256: string): Promise<void> {
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

function lineRecord(sequence: number, line: NormalizedStatementLine, source: Readonly<Record<string, string>>) {
  return Object.freeze({ sequence, reference: line.reference, kind: line.kind, amount: line.amount, tax: line.tax,
    currency: line.currency, occurred: line.occurred, hash: createHash('sha256').update(JSON.stringify(source)).digest('hex') });
}

async function lineSummary(database: Database, reconciliation: string): Promise<Readonly<{ count: number; payments: number; refunds: number; references: string[] }>> {
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
