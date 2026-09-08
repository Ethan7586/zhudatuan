import { PgTransactionAccess, type SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { TransactionManager } from '../../../../platform/database/TransactionManager';
import type { PayoutGateway } from '../../application/port/PayoutGateway';
import { SettlementPolicy } from '../../domain/policy/SettlementPolicy';
import type { FinanceJobExecution, SettlementJobProcess } from '../../application/port/FinanceJobProcess';
import { Settlement, type SettlementValue } from '../../domain/model/Settlement';
import { InputWatermark } from '../../domain/value/InputWatermark';
import { financeFingerprint } from '../../domain/value/FinanceFingerprint';
import { PgPayoutProcess } from './PgPayoutProcess';
import type { FinanceOrderPort } from '../../../order/public';
import type { FinancePaymentPort } from '../../../payment/public';

import {
  assertFrozenSettlement,
  assertSettlement,
  assertSettlementTotals,
  assertVerifiedSources,
  findSettlement,
  findSettlementByReconciliation,
  options,
  settlementHash,
  type ExistingSettlement,
  type SettlementBasis,
  type SettlementSourceLine,
} from './SettlementStore';
export class PgSettlementProcess implements SettlementJobProcess {
  private readonly policy = new SettlementPolicy();
  private readonly access = new PgTransactionAccess();
  private readonly payout: PgPayoutProcess;

  constructor(
    private readonly transactions: TransactionManager,
    payouts: PayoutGateway,
    private readonly payments: FinancePaymentPort,
    private readonly orders: FinanceOrderPort
  ) {
    this.payout = new PgPayoutProcess(transactions, payouts);
  }

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
        [
          proposal.id,
          proposal.partnerId,
          proposal.period,
          proposal.reconciliationId,
          proposal.amountMinor,
          proposal.scopeId,
          proposal.requestedBy,
          basis.statement_hash,
          split.basisPoints,
          proposal.grossMinor,
          proposal.feeMinor,
          proposal.invoiceBasis,
          watermark.snapshot().hash,
          watermark.snapshot().count,
          watermark.snapshot().occurredAt,
        ]
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
