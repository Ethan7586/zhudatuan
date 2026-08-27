import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { FinancePort } from '../../FinancePort';
import type { PayoutGateway } from '../../application/port/PayoutGateway';
import { SettlementPolicy } from '../../domain/policy/SettlementPolicy';

export class SettlementJobProcessor implements JobProcessor {
  private readonly finance = new FinancePort();
  private readonly policy = new SettlementPolicy();

  constructor(private readonly pool: DatabasePool, private readonly payouts: PayoutGateway) {}

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== 'settlement') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const payload = object(job.payload);
    if (payload.withdrawal) return this.withdraw(text(payload.withdrawal, 'WITHDRAWAL_REQUIRED'));
    return this.settle(text(payload.reconciliation, 'RECONCILIATION_REQUIRED'));
  }

  private async settle(reconciliation: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const source = await client.query<{ scope_id: string; partner_id: string; period: string; credit_minor: number; created_by: string; statement_hash: string }>(`select
        reconciliation.scope_id,reconciliation.partner_id,reconciliation.period,reconciliation.credit_minor::float8 credit_minor,
        reconciliation.created_by,reconciliation.statement_hash from finance.reconciliation reconciliation where reconciliation.id=$1
        and reconciliation.state='approved' and reconciliation.difference_minor=0 and reconciliation.credit_minor>0
        and not exists(select 1 from finance.reconciliationitem item where item.reconciliation_id=reconciliation.id
          and item.state not in('matched','resolved')) for update`, [reconciliation]);
      const basis = source.rows[0];
      if (!basis) throw new Error('SETTLEMENT_NOT_RUNNABLE');
      const rule = (await client.query<{ rule: unknown }>(`select rule from finance.policy where scope_id=$1 and kind='settlement' and state='active'`,
      [basis.scope_id])).rows[0]?.rule;
      const split = this.policy.split(basis.credit_minor, rule);
      const result = await client.query<{ id: string; scope_id: string }>(`insert into finance.settlement(id,partner_id,period,reconciliation_id,
        amount_minor,currency,state,scope_id,requested_by,frozen_at,evidence,version,gross_minor,fee_minor,invoice_basis)
        values($1,$2,$3,$4,$5,'CNY','draft',$6,$7,clock_timestamp(),jsonb_build_object('reconciliation',$4,'statementHash',$8,
          'splitBasisPoints',$9),0,$10,$11,$12) on conflict(partner_id,period) do nothing returning id,scope_id`,
      [`settlement:${reconciliation}`, basis.partner_id, basis.period, reconciliation, split.netMinor, basis.scope_id, basis.created_by,
        basis.statement_hash, split.basisPoints, split.grossMinor, split.feeMinor, split.invoiceBasis]);
      const settlement = result.rows[0];
      if (!settlement) throw new Error('SETTLEMENT_NOT_RUNNABLE');
      await client.query(`insert into finance.settlementline(id,settlement_id,reconciliation_item_id,scope_id,source_type,source_id,
        amount_minor,invoice_minor,tax_minor,direction,state,created_at) select 'settlementline:'||item.id,$1,item.id,$2,
        coalesce(item.internal_type,'statement'),coalesce(item.internal_id,line.external_reference),item.internal_minor,item.internal_minor,
        line.tax_minor,case when line.kind in('refund','fee') then 'decrease' else 'increase' end,'frozen',clock_timestamp()
        from finance.reconciliationitem item join finance.statementline line on line.id=item.statement_line_id
        where item.reconciliation_id=$3 and item.state in('matched','resolved') and item.internal_minor>0
        on conflict(id) do nothing`, [settlement.id, settlement.scope_id, reconciliation]);
      if (split.invoiceBasis === 'net' && split.feeMinor > 0) await client.query(`with eligible as(
          select line.id,line.amount_minor,row_number() over(order by line.id) sequence,count(*) over() count,
            sum(line.amount_minor) over() total from finance.settlementline line
          where line.settlement_id=$1 and line.direction='increase'), allocated as(
          select id,case when sequence=count then $2-coalesce(sum(floor(amount_minor::numeric*$2/total)) over(
            rows between unbounded preceding and 1 preceding),0) else floor(amount_minor::numeric*$2/total) end invoice_minor from eligible)
        update finance.settlementline line set invoice_minor=allocated.invoice_minor from allocated where line.id=allocated.id`,
      [settlement.id, split.netMinor]);
      await client.query(`insert into finance.split(id,settlement_id,scope_id,beneficiary_type,beneficiary_id,amount_minor,basis_points,state,created_at)
        values($1,$2,$3,'partner',$4,$5,$6,'frozen',clock_timestamp())`,
      [`split:${settlement.id}:partner`, settlement.id, settlement.scope_id, basis.partner_id, split.netMinor, 10_000-split.basisPoints]);
      if (split.feeMinor > 0) await client.query(`insert into finance.split(id,settlement_id,scope_id,beneficiary_type,beneficiary_id,amount_minor,
        basis_points,state,created_at) values($1,$2,$3,'platform','platform',$4,$5,'frozen',clock_timestamp())`,
      [`split:${settlement.id}:platform`, settlement.id, settlement.scope_id, split.feeMinor, split.basisPoints]);
      const total = await client.query<{ lines: number; settlement: number }>(`select
        coalesce(sum(case line.direction when 'decrease' then -line.amount_minor else line.amount_minor end),0)::float8 lines,
        settlement.gross_minor::float8 settlement from finance.settlement settlement
        left join finance.settlementline line on line.settlement_id=settlement.id
        where settlement.id=$1 group by settlement.gross_minor`, [settlement.id]);
      if (!total.rows[0] || total.rows[0].lines !== total.rows[0].settlement) throw new Error('SETTLEMENT_LINE_TOTAL_MISMATCH');
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }

  private async withdraw(id: string): Promise<void> {
    const selected = await this.pool.query<{ id: string; destination_ref: string; amount_minor: number; currency: string }>(`update finance.withdrawal
      set state='processing',updated_at=clock_timestamp(),version=version+1 where id=$1 and state in('approved','processing')
      returning id,destination_ref,amount_minor::float8 amount_minor,currency`, [id]);
    const withdrawal = selected.rows[0];
    if (!withdrawal) {
      const complete = await this.pool.query(`select 1 from finance.withdrawal where id=$1 and state in('paid','failed')`, [id]);
      if (complete.rows[0]) return;
      throw new Error('WITHDRAWAL_NOT_RUNNABLE');
    }
    const payout = await this.payouts.submit({ withdrawal: id, destination: withdrawal.destination_ref,
      amountMinor: withdrawal.amount_minor, currency: withdrawal.currency });
    if (payout.state === 'processing') throw new Error('PAYOUT_PROCESSING');
    if (payout.state === 'failed') {
      await this.pool.query(`update finance.withdrawal set state='failed',provider_reference=$2,evidence=evidence||$3::jsonb,
        updated_at=clock_timestamp(),version=version+1 where id=$1 and state='processing'`,
      [id, payout.reference, JSON.stringify({ payoutReason: payout.reason ?? 'PROVIDER_REJECTED' })]);
      return;
    }
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const locked = await client.query<{ scope_id: string; settlement_id: string; partner_id: string; amount_minor: number; currency: string }>(`select
        withdrawal.scope_id,withdrawal.settlement_id,settlement.partner_id,withdrawal.amount_minor::float8 amount_minor,withdrawal.currency
        from finance.withdrawal withdrawal join finance.settlement settlement on settlement.id=withdrawal.settlement_id
        where withdrawal.id=$1 and withdrawal.state='processing' for update`, [id]);
      const row = locked.rows[0];
      if (!row) { await client.query('commit'); return; }
      await this.finance.post(client, { scope: row.scope_id, referenceType: 'finance.withdrawal.paid', referenceId: id,
        currency: row.currency, description: 'Settlement payout', debit: { code: `settlement.payable.${row.partner_id}`, kind: 'liability' },
        credit: { code: 'cash', kind: 'asset' }, amountMinor: row.amount_minor });
      await client.query(`update finance.withdrawal set state='paid',provider_reference=$2,paid_at=clock_timestamp(),
        updated_at=clock_timestamp(),version=version+1 where id=$1`, [id, payout.reference]);
      await client.query(`update finance.settlement settlement set state='paid',paid_at=clock_timestamp(),version=version+1 where id=$1 and state='payable'
        and amount_minor=(select coalesce(sum(amount_minor),0) from finance.withdrawal where settlement_id=$1 and state='paid')`, [row.settlement_id]);
      await client.query(`update finance.split set state='paid' where settlement_id=$1 and beneficiary_type='partner' and state='frozen'
        and exists(select 1 from finance.settlement where id=$1 and state='paid')`, [row.settlement_id]);
      await client.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
        values($1,'finance.withdrawal.paid',1,'withdrawal',$2,$3,jsonb_build_object('withdrawal',$2,'settlement',$4,'amountMinor',$5,'currency',$6),
        $1,clock_timestamp(),clock_timestamp()) on conflict(id) do nothing`,
      [`event:finance:withdrawal:${id}`, id, row.scope_id, row.settlement_id, row.amount_minor, row.currency]);
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }
}

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Record<string, unknown>;
}
function text(value: unknown, code: string): string { if (typeof value !== 'string' || !value) throw new Error(code); return value; }
