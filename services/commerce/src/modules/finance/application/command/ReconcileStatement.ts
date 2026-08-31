import { createHash } from 'node:crypto';
import type { ObjectStore } from '../../../../foundation/infrastructure/ObjectStore';
import { parseCsv } from '../../../../foundation/infrastructure/Csv';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { FinanceChannelPort } from '../../../channel/public';
import type { FinanceFulfillmentPort } from '../../../fulfillment/public';
import type { FinancePaymentPort } from '../../../payment/public';

export class ReconcileStatement {
  constructor(
    private readonly pool: DatabasePool,
    private readonly objects: ObjectStore,
    private readonly channel: FinanceChannelPort,
    private readonly payments: FinancePaymentPort,
    private readonly fulfillments: FinanceFulfillmentPort
  ) {}

  async execute(id: string): Promise<void> {
    const loaded = await this.pool.query<Source>(
      `select scope_id,statement_hash,statement_ref from finance.reconciliation
      where id=$1 and state in('received','matching','difference')`,
      [id]
    );
    const source = loaded.rows[0];
    if (!source) throw new Error('RECONCILIATION_NOT_RUNNABLE');
    const statement = await this.channel.statement(this.pool, source.statement_ref, source.scope_id);
    if (!statement || statement.sha256 !== source.statement_hash) throw new Error('STATEMENT_INTEGRITY_FAILED');
    const claimed = await this.pool.query(
      `update finance.reconciliation set state='matching',updated_at=clock_timestamp()
      where id=$1 and state in('received','matching','difference') returning id`,
      [id]
    );
    if (!claimed.rows[0]) throw new Error('RECONCILIATION_NOT_RUNNABLE');
    const bytes = await this.objects.read(statement.objectRef, 64 * 1024 * 1024);
    if (createHash('sha256').update(bytes).digest('hex') !== source.statement_hash) throw new Error('STATEMENT_INTEGRITY_FAILED');
    const rows = parseCsv(bytes, 1_000_000);
    const totals = validate(rows);
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      for (let offset = 0; offset < rows.length; offset += 5_000) {
        const values = rows.slice(offset, offset + 5_000).map((row, index) => ({
          sequence: offset + index + 1,
          reference: row.reference,
          kind: row.type,
          amount: Number(row.amountMinor),
          tax: row.taxMinor === undefined ? 0 : Number(row.taxMinor),
          currency: row.currency,
          occurred: row.occurredAt ?? null,
          hash: createHash('sha256').update(JSON.stringify(row)).digest('hex'),
        }));
        await client.query(
          `insert into finance.statementline(id,reconciliation_id,scope_id,sequence,external_reference,kind,amount_minor,
          tax_minor,currency,occurred_at,raw_hash) select 'statementline:'||$1||':'||record.sequence,$1,$2,record.sequence,
          record.reference,record.kind,record.amount,record.tax,record.currency,record.occurred,record.hash
          from jsonb_to_recordset($3::jsonb) record(sequence integer,reference text,kind text,amount bigint,tax bigint,currency char(3),
            occurred timestamptz,hash char(64)) on conflict(reconciliation_id,sequence) do nothing`,
          [id, source.scope_id, JSON.stringify(values)]
        );
      }
      const references = Object.freeze([...new Set(rows.map((row) => text(row.reference, 'STATEMENT_REFERENCE_REQUIRED')))].sort());
      const [payments, fulfillments] = await Promise.all([this.payments.reconciliation(client, references), this.fulfillments.reconciliation(client, references)]);
      await match(client, id, source.scope_id, Object.freeze([...payments, ...fulfillments]));
      const internal = await client.query<{ net: number; differences: number }>(
        `select coalesce(sum(case line.kind when 'refund' then
          -item.internal_minor when 'fee' then -item.internal_minor else item.internal_minor end),0)::float8 net,
        count(*) filter(where item.state='difference')::integer differences from finance.reconciliationitem item
        join finance.statementline line on line.id=item.statement_line_id where item.reconciliation_id=$1`,
        [id]
      );
      const summary = internal.rows[0]!;
      const providerNet = totals.payments - totals.refunds;
      const result = await client.query(
        `update finance.reconciliation set debit_minor=$2,credit_minor=$3,difference_minor=$2-$3,
        evidence=$4::jsonb,state=case when $5=0 and $2=$3 then 'balanced' else 'difference' end,updated_at=clock_timestamp(),
        version=version+1 where id=$1 and state='matching' returning *`,
        [id, providerNet, summary.net, JSON.stringify({ rowCount: rows.length, provider: totals, internalNet: summary.net, differences: summary.differences, statementHash: source.statement_hash }), summary.differences]
      );
      if (!result.rows[0]) throw new Error('RECONCILIATION_NOT_RUNNABLE');
      if (summary.differences > 0 || providerNet !== summary.net) await difference(client, id, source.scope_id, providerNet - summary.net, summary.differences);
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
    }
  }
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
  await database.query(
    `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,
    available_at) values($1,'finance.reconciliation.difference',1,'reconciliation',$2,$3,
    jsonb_build_object('reconciliation',$2,'differenceMinor',$4,'itemCount',$5),$1,clock_timestamp(),clock_timestamp()) on conflict(id) do nothing`,
    [`event:${digest(`finance:reconciliation:${id}`)}`, id, scope, amount, count]
  );
}

function validate(rows: readonly Readonly<Record<string, unknown>>[]): Readonly<{ payments: number; refunds: number }> {
  const references = new Set<string>();
  let payments = 0;
  let refunds = 0;
  for (const row of rows) {
    const reference = text(row.reference, 'STATEMENT_REFERENCE_REQUIRED');
    if (references.has(reference)) throw new Error('STATEMENT_REFERENCE_DUPLICATE');
    references.add(reference);
    const amount = positive(row.amountMinor, 'STATEMENT_AMOUNT_INVALID');
    if (row.currency !== 'CNY') throw new Error('STATEMENT_CURRENCY_UNSUPPORTED');
    if (row.type === 'payment') payments += amount;
    else if (row.type === 'refund') refunds += amount;
    else throw new Error('STATEMENT_TYPE_INVALID');
    if (!Number.isSafeInteger(payments) || !Number.isSafeInteger(refunds)) throw new Error('STATEMENT_TOTAL_OVERFLOW');
  }
  return { payments, refunds };
}

interface Source {
  readonly scope_id: string;
  readonly statement_hash: string;
  readonly statement_ref: string;
}
interface ReconciliationMatch {
  readonly reference: string;
  readonly kind: string;
  readonly id: string;
  readonly amountMinor: number;
}
interface Database {
  query<R extends Record<string, unknown> = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<Readonly<{ rows: readonly R[] }>>;
}
function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value) throw new Error(code);
  return value;
}
function positive(value: unknown, code: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(code);
  return parsed;
}
function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}
