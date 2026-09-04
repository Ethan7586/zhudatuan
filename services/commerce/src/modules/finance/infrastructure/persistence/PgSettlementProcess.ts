import { PgTransactionAccess, type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';
import type { PayoutGateway } from '../../application/port/PayoutGateway';
import { SettlementPolicy } from '../../domain/policy/SettlementPolicy';
import type { FinanceJobExecution, SettlementJobProcess } from '../../application/port/FinanceJobProcess';
import { Settlement, type SettlementValue } from '../../domain/model/Settlement';
import { InputWatermark } from '../../domain/value/InputWatermark';
import { financeFingerprint } from '../../domain/value/FinanceFingerprint';
import { PgPayoutProcess } from './PgPayoutProcess';
import type { FinanceOrderPort } from '../../../order/public';
import type { FinancePaymentPort } from '../../../payment/public';

export class PgSettlementProcess implements SettlementJobProcess {
  private readonly policy = new SettlementPolicy();
  private readonly access = new PgTransactionAccess();
  private readonly payout: PgPayoutProcess;

  constructor(
    private readonly transactions: TransactionManager,
    payouts: PayoutGateway,
    private readonly payments: FinancePaymentPort,
    private readonly orders: FinanceOrderPort
  ) { this.payout = new PgPayoutProcess(transactions, payouts); }

  settle(input: Readonly<{ reconciliation: string; business: string }>, execution: FinanceJobExecution): Promise<void> {
    const { reconciliation } = input;
    return this.transactions.write(options(execution), async (context) => {
      const client = this.access.database(context);
      await client.query(`select pg_advisory_xact_lock(hashtextextended('finance:settlement:'||$1,0))`, [reconciliation]);
      const frozen = await findSettlementByReconciliation(client, reconciliation);
      if (frozen) {
        assertFrozenSettlement(frozen, input.business, reconciliation);
        await assertSettlementTotals(client, frozen.id, frozen.input_count, frozen.input_minor);
        return;
      }
      const source = await client.query<SettlementBasis>(
        `select reconciliation.scope_id,reconciliation.partner_id,reconciliation.period,
        reconciliation.credit_minor::float8 credit_minor,reconciliation.created_by,reconciliation.statement_hash,
        reconciliation.version::float8 version,reconciliation.updated_at,policy.rule,
        coalesce(policy.rule::text,'{}') rule_text from finance.reconciliation reconciliation
        left join finance.policy policy on policy.scope_id=reconciliation.scope_id and policy.kind='settlement' and policy.state='active'
        where reconciliation.id=$1 and reconciliation.state='approved' and reconciliation.difference_minor=0
        and reconciliation.credit_minor>0 and not exists(select 1 from finance.reconciliationitem item
          where item.reconciliation_id=reconciliation.id and item.state not in('matched','resolved')) for update of reconciliation`,
        [reconciliation]
      );
      const basis = source.rows[0];
      if (!basis) throw new Error('SETTLEMENT_NOT_RUNNABLE');
      const lines = await client.query<SettlementSourceLine>(
        `select item.id,item.internal_type,item.internal_id,item.internal_minor::float8 internal_minor,
        item.version::float8 version,line.external_reference,line.kind,line.tax_minor::float8 tax_minor,line.raw_hash
        from finance.reconciliationitem item join finance.statementline line on line.id=item.statement_line_id
        where item.reconciliation_id=$1 and item.state in('matched','resolved') and item.internal_minor>0
        order by item.id for update of item,line`,
        [reconciliation]
      );
      if (lines.rows.length === 0) throw new Error('SETTLEMENT_SOURCE_EMPTY');
      await assertVerifiedSources(context, lines.rows, this.payments, this.orders);
      const split = this.policy.split(basis.credit_minor, basis.rule);
      const proposal = Settlement.fromSplit(
        {
          id: input.business,
          scopeId: basis.scope_id,
          reconciliationId: reconciliation,
          partnerId: basis.partner_id,
          period: basis.period,
          currency: 'CNY',
          requestedBy: basis.created_by,
        },
        split
      ).snapshot();
      const hash = settlementHash(proposal.id, basis, lines.rows);
      const watermark = InputWatermark.restore({ hash, count: lines.rows.length, occurredAt: new Date(basis.updated_at).toISOString() });
      const existing = await findSettlement(client, reconciliation, basis.partner_id, basis.period);
      if (existing) {
        assertSettlement(existing, proposal, watermark);
        await assertSettlementTotals(client, existing.id, watermark.snapshot().count, proposal.grossMinor);
        return;
      }
      const result = await client.query<ExistingSettlement>(
        `insert into finance.settlement(id,partner_id,period,reconciliation_id,amount_minor,currency,state,scope_id,
        requested_by,frozen_at,evidence,version,gross_minor,fee_minor,invoice_basis,input_hash,input_count,input_minor,input_watermark)
        values($1,$2,$3,$4,$5,'CNY','draft',$6,$7,clock_timestamp(),jsonb_build_object('reconciliation',$4,
          'statementHash',$8,'splitBasisPoints',$9,'inputHash',$13,'inputCount',$14,'inputWatermark',$15::timestamptz),
          0,$10,$11,$12,$13,$14,$10,$15::timestamptz) on conflict(partner_id,period) do nothing
        returning id,scope_id,partner_id,period,reconciliation_id,amount_minor::float8 amount_minor,
          gross_minor::float8 gross_minor,fee_minor::float8 fee_minor,currency,invoice_basis,input_hash,input_count,
          input_minor::float8 input_minor,input_watermark`,
        [proposal.id, proposal.partnerId, proposal.period, proposal.reconciliationId, proposal.amountMinor, proposal.scopeId,
          proposal.requestedBy, basis.statement_hash, split.basisPoints, proposal.grossMinor, proposal.feeMinor,
          proposal.invoiceBasis, watermark.snapshot().hash, watermark.snapshot().count, watermark.snapshot().occurredAt]
      );
      const settlement = result.rows[0] ?? (await findSettlement(client, reconciliation, basis.partner_id, basis.period));
      if (!settlement) throw new Error('SETTLEMENT_NOT_RUNNABLE');
      assertSettlement(settlement, proposal, watermark);
      await client.query(
        `with source as(
        select input.id,input.internal_type,input.internal_id,input.external_reference,input.internal_minor,input.tax_minor,input.kind,
          case when input.kind in('refund','fee') then 'decrease' else 'increase' end direction
        from jsonb_to_recordset($3::jsonb) input(id text,internal_type text,internal_id text,external_reference text,
          internal_minor bigint,tax_minor bigint,kind text)), allocated as(
        select source.id,source.internal_type,source.internal_id,source.external_reference,source.internal_minor,source.tax_minor,source.kind,source.direction,
          row_number() over(partition by direction order by id) sequence,count(*) over(partition by direction) count,
          sum(internal_minor) over(partition by direction) total from source)
        insert into finance.settlementline(id,settlement_id,reconciliation_item_id,scope_id,source_type,source_id,
        amount_minor,invoice_minor,tax_minor,direction,state,created_at)
        select 'settlementline:'||allocated.id,$1,allocated.id,$2,coalesce(allocated.internal_type,'statement'),
          coalesce(allocated.internal_id,allocated.external_reference),allocated.internal_minor,
          case when $4='net' and allocated.direction='increase' then case when allocated.sequence=allocated.count
            then $5-coalesce(sum(floor(allocated.internal_minor::numeric*$5/allocated.total)) over(
              partition by allocated.direction order by allocated.id rows between unbounded preceding and 1 preceding),0)
            else floor(allocated.internal_minor::numeric*$5/allocated.total) end else allocated.internal_minor end,
          allocated.tax_minor,allocated.direction,'frozen',clock_timestamp() from allocated on conflict(id) do nothing`,
        [settlement.id, settlement.scope_id, JSON.stringify(lines.rows), split.invoiceBasis, split.netMinor]
      );
      await client.query(
        `insert into finance.split(id,settlement_id,scope_id,beneficiary_type,beneficiary_id,amount_minor,basis_points,state,created_at)
        values($1,$2,$3,'partner',$4,$5,$6,'frozen',clock_timestamp()) on conflict(id) do nothing`,
        [`split:${settlement.id}:partner`, settlement.id, settlement.scope_id, basis.partner_id, split.netMinor, 10_000 - split.basisPoints]
      );
      if (split.feeMinor > 0)
        await client.query(
          `insert into finance.split(id,settlement_id,scope_id,beneficiary_type,beneficiary_id,amount_minor,
          basis_points,state,created_at) values($1,$2,$3,'platform','platform',$4,$5,'frozen',clock_timestamp()) on conflict(id) do nothing`,
          [`split:${settlement.id}:platform`, settlement.id, settlement.scope_id, split.feeMinor, split.basisPoints]
        );
      await assertSettlementTotals(client, settlement.id, watermark.snapshot().count, proposal.grossMinor);
    });
  }

  async withdraw(input: Readonly<{ withdrawal: string; business: string }>, execution: FinanceJobExecution): Promise<void> {
    return this.payout.execute(input, execution);
  }
}

async function assertVerifiedSources(context: Parameters<FinancePaymentPort['orders']>[0], lines: readonly SettlementSourceLine[], payments: FinancePaymentPort, orders: FinanceOrderPort): Promise<void> {
  const paymentIds = distinct(lines.filter(({ internal_type }) => internal_type === 'payment').flatMap(({ internal_id }) => internal_id ? [internal_id] : []));
  const paymentOrders = await payments.orders(context, paymentIds);
  if (new Set(paymentOrders.map(({ payment }) => payment)).size !== paymentIds.length) throw new Error('SETTLEMENT_NOT_RUNNABLE');
  const orderIds = distinct([
    ...lines.filter(({ internal_type }) => internal_type === 'order').flatMap(({ internal_id }) => internal_id ? [internal_id] : []),
    ...paymentOrders.map(({ order }) => order),
  ]);
  if (new Set(await orders.verified(context, orderIds)).size !== orderIds.length) throw new Error('SETTLEMENT_NOT_RUNNABLE');
}

function distinct(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort());
}

async function findSettlement(client: SqlExecutor, reconciliation: string, partner: string, period: string): Promise<ExistingSettlement | undefined> {
  const result = await client.query<ExistingSettlement>(
    `select id,scope_id,partner_id,period,reconciliation_id,amount_minor::float8 amount_minor,
    gross_minor::float8 gross_minor,fee_minor::float8 fee_minor,currency,invoice_basis,input_hash,input_count,
    input_minor::float8 input_minor,input_watermark
    from finance.settlement where reconciliation_id=$1 or (partner_id=$2 and period=$3) order by id limit 1 for update`,
    [reconciliation, partner, period]
  );
  return result.rows[0];
}

async function findSettlementByReconciliation(client: SqlExecutor, reconciliation: string): Promise<ExistingSettlement | undefined> {
  const result = await client.query<ExistingSettlement>(
    `select id,scope_id,partner_id,period,reconciliation_id,amount_minor::float8 amount_minor,
    gross_minor::float8 gross_minor,fee_minor::float8 fee_minor,currency,invoice_basis,input_hash,input_count,
    input_minor::float8 input_minor,input_watermark from finance.settlement where reconciliation_id=$1 for update`,
    [reconciliation]
  );
  return result.rows[0];
}

function assertFrozenSettlement(existing: ExistingSettlement, business: string, reconciliation: string): void {
  InputWatermark.restore({ hash: existing.input_hash, count: Number(existing.input_count),
    occurredAt: new Date(existing.input_watermark).toISOString() });
  if (existing.id !== business || existing.reconciliation_id !== reconciliation) throw new Error('SETTLEMENT_BUSINESS_NUMBER_CONFLICT');
}

function assertSettlement(existing: ExistingSettlement, proposal: SettlementValue, watermark: InputWatermark): void {
  watermark.assert(existing.input_hash, Number(existing.input_count));
  if (existing.id !== proposal.id || existing.scope_id !== proposal.scopeId || existing.partner_id !== proposal.partnerId ||
    existing.period !== proposal.period || existing.reconciliation_id !== proposal.reconciliationId || existing.currency !== proposal.currency ||
    Number(existing.gross_minor) !== proposal.grossMinor || Number(existing.fee_minor) !== proposal.feeMinor ||
    Number(existing.amount_minor) !== proposal.amountMinor || existing.invoice_basis !== proposal.invoiceBasis)
    throw new Error('SETTLEMENT_INPUT_SNAPSHOT_CHANGED');
}

async function assertSettlementTotals(client: SqlExecutor, settlement: string, count: number, inputMinor: number): Promise<void> {
  const result = await client.query<{ line_count: number; line_total: number; split_total: number; current_gross: number }>(
    `select count(line.id) filter(where line.adjustment_of is null)::float8 line_count,
    coalesce(sum(case when line.direction='decrease' then -line.amount_minor else line.amount_minor end)
      filter(where line.adjustment_of is null),0)::float8 line_total,
    (select coalesce(sum(amount_minor),0)::float8 from finance.split where settlement_id=$1) split_total,
    settlement.gross_minor::float8 current_gross from finance.settlement settlement
    left join finance.settlementline line on line.settlement_id=settlement.id where settlement.id=$1 group by settlement.gross_minor`,
    [settlement]
  );
  const total = result.rows[0];
  if (!total || Number(total.line_count) !== count || Number(total.line_total) !== inputMinor ||
    Number(total.split_total) !== Number(total.current_gross))
    throw new Error('SETTLEMENT_FROZEN_TOTAL_MISMATCH');
}

function settlementHash(id: string, basis: SettlementBasis, lines: readonly SettlementSourceLine[]): string {
  const serialized = lines.map((line) => [line.id, line.internal_type ?? '', line.internal_id ?? '', line.internal_minor,
    line.version, line.external_reference, line.kind, line.tax_minor, line.raw_hash].join('\u001f')).join('\u001e');
  return financeFingerprint([id, basis.scope_id, basis.partner_id, basis.period, basis.credit_minor, basis.statement_hash,
    basis.version, basis.rule_text, serialized]);
}

function options(execution: FinanceJobExecution) {
  return { tenant: execution.scope, membership: '', scope: execution.scope, actor: 'job:settlement', trace: execution.trace,
    operation: 'job.finance.settlement', workload: 'jobs' as const, signal: execution.signal, deadline: execution.deadline };
}

interface SettlementBasis {
  readonly scope_id: string; readonly partner_id: string; readonly period: string; readonly credit_minor: number;
  readonly created_by: string; readonly statement_hash: string; readonly version: number; readonly updated_at: string;
  readonly rule: unknown; readonly rule_text: string;
}
interface SettlementSourceLine {
  readonly id: string; readonly internal_type: string | null; readonly internal_id: string | null; readonly internal_minor: number;
  readonly version: number; readonly external_reference: string; readonly kind: string; readonly tax_minor: number; readonly raw_hash: string;
}
interface ExistingSettlement {
  readonly id: string; readonly scope_id: string; readonly partner_id: string; readonly period: string;
  readonly reconciliation_id: string; readonly amount_minor: number; readonly gross_minor: number; readonly fee_minor: number;
  readonly currency: string; readonly invoice_basis: 'gross' | 'net'; readonly input_hash: string;
  readonly input_count: number; readonly input_minor: number; readonly input_watermark: string;
}
