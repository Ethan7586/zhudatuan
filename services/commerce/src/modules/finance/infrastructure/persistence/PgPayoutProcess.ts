import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { TransactionManager } from '../../../../platform/database/TransactionManager';
import type { FinanceJobExecution } from '../../application/port/FinanceJobProcess';
import type { PayoutGateway, PayoutResult } from '../../application/port/PayoutGateway';
import { InputWatermark } from '../../domain/value/InputWatermark';
import { financeFingerprint } from '../../domain/value/FinanceFingerprint';
import { PgAccountingPort } from './PgAccountingPort';

export class PgPayoutProcess {
  private readonly access = new PgTransactionAccess();
  private readonly finance = new PgAccountingPort();
  constructor(
    private readonly transactions: TransactionManager,
    private readonly payouts: PayoutGateway
  ) {}

  async execute(input: Readonly<{ withdrawal: string; business: string }>, execution: FinanceJobExecution): Promise<void> {
    const id = input.withdrawal;
    if (input.business !== id) throw new Error('PAYOUT_BUSINESS_NUMBER_INVALID');
    const withdrawal = await this.claim(id, execution);
    if (!withdrawal) return;
    const payout = await this.payouts.submit({ withdrawal: id, inputHash: requiredHash(withdrawal.request_hash), destination: withdrawal.destination_ref, amountMinor: withdrawal.amount_minor, currency: withdrawal.currency });
    if (payout.state !== 'paid') {
      await this.save(id, requiredHash(withdrawal.request_hash), payout, execution);
      if (payout.state === 'processing') throw new Error('PAYOUT_PROCESSING');
      return;
    }
    await this.complete(withdrawal, payout, execution);
  }

  private async claim(id: string, execution: FinanceJobExecution): Promise<WithdrawalRow | null> {
    return this.transactions.write(options(execution), async (context) => {
      const database = this.access.database(context);
      await database.query(`select pg_advisory_xact_lock(hashtextextended('finance:withdrawal:'||$1,0))`, [id]);
      const selected = await database.query<WithdrawalRow>(
        `select id,scope_id,settlement_id,destination_ref,amount_minor::float8 amount_minor,currency,state,
        request_hash,input_watermark,provider,provider_reference,created_at,version::float8 version
        from finance.withdrawal where id=$1 for update`,
        [id]
      );
      const current = selected.rows[0];
      if (!current) throw new Error('WITHDRAWAL_NOT_RUNNABLE');
      if (current.state === 'paid' || current.state === 'failed') return null;
      if (current.state !== 'approved' && current.state !== 'processing') throw new Error('WITHDRAWAL_NOT_RUNNABLE');
      const hash = payoutHash(current);
      if (current.state === 'processing') {
        InputWatermark.restore({ hash: requiredHash(current.request_hash), count: 1, occurredAt: date(current.input_watermark) }).assert(hash, 1);
        return Object.freeze({ ...current, request_hash: hash });
      }
      const claimed = await database.query<WithdrawalRow>(
        `update finance.withdrawal set state='processing',request_hash=$2,input_watermark=created_at,
        updated_at=clock_timestamp(),version=version+1 where id=$1 and state='approved'
        returning id,scope_id,settlement_id,destination_ref,amount_minor::float8 amount_minor,currency,state,
          request_hash,input_watermark,provider,provider_reference,created_at,version::float8 version`,
        [id, hash]
      );
      if (!claimed.rows[0]) throw new Error('WITHDRAWAL_CLAIM_CONFLICT');
      return claimed.rows[0];
    });
  }

  private async complete(withdrawal: WithdrawalRow, payout: PayoutResult, execution: FinanceJobExecution): Promise<void> {
    const id = withdrawal.id;
    await this.transactions.write(options(execution), async (context) => {
      const client = this.access.database(context);
      const locked = await client.query<PayoutWithdrawal>(
        `select withdrawal.scope_id,withdrawal.settlement_id,settlement.partner_id,
        withdrawal.amount_minor::float8 amount_minor,withdrawal.currency,withdrawal.provider,
        withdrawal.provider_reference from finance.withdrawal withdrawal
        join finance.settlement settlement on settlement.id=withdrawal.settlement_id
        where withdrawal.id=$1 and withdrawal.state='processing' and withdrawal.request_hash=$2
        and (withdrawal.provider is null or withdrawal.provider=$3)
        and (withdrawal.provider_reference is null or withdrawal.provider_reference=$4) for update of withdrawal`,
        [id, withdrawal.request_hash, payout.provider, payout.reference]
      );
      const row = locked.rows[0];
      if (!row) {
        const complete = await client.query(`select 1 from finance.withdrawal where id=$1 and state='paid'`, [id]);
        if (complete.rows[0]) return;
        throw new Error('PAYOUT_RECEIPT_CONFLICT');
      }
      await this.finance.post(context, {
        scopeId: row.scope_id,
        source: { module: 'finance', aggregate: 'withdrawal', aggregateId: id, event: 'finance.withdrawal.paid', eventId: id, leg: 'payout' },
        currency: row.currency,
        description: 'Settlement payout',
        debit: { code: `settlement.payable.${row.partner_id}`, kind: 'liability' },
        credit: { code: 'cash', kind: 'asset' },
        amountMinor: row.amount_minor,
      });
      const updated = await client.query(
        `update finance.withdrawal set state='paid',provider=$3,provider_reference=$4,provider_state='paid',response_hash=$5,
        paid_at=clock_timestamp(),evidence=evidence||$6::jsonb,updated_at=clock_timestamp(),version=version+1
        where id=$1 and state='processing' and request_hash=$2 returning id`,
        [id, withdrawal.request_hash, payout.provider, payout.reference, payoutHashResult(payout), JSON.stringify({ payoutState: payout.state, payoutReference: payout.reference })]
      );
      if (!updated.rows[0]) throw new Error('PAYOUT_RECEIPT_CONFLICT');
      await client.query(
        `update finance.settlement settlement set state='paid',paid_at=clock_timestamp(),version=version+1 where id=$1 and state='payable'
        and amount_minor=(select coalesce(sum(amount_minor),0) from finance.withdrawal where settlement_id=$1 and state='paid')`,
        [row.settlement_id]
      );
      await client.query(
        `update finance.split set state='paid' where settlement_id=$1 and beneficiary_type='partner' and state='frozen'
        and exists(select 1 from finance.settlement where id=$1 and state='paid')`,
        [row.settlement_id]
      );
      const event = `event:finance:withdrawal:${id}`;
      await new PgRuntimeWriter(client).append({
        id: event,
        type: 'finance.withdrawal.paid',
        aggregateType: 'withdrawal',
        aggregate: id,
        scope: row.scope_id,
        payload: { withdrawal: id, settlement: row.settlement_id, amountMinor: row.amount_minor, currency: row.currency, provider: payout.provider, providerReference: payout.reference },
        trace: event,
      });
    });
  }

  private async save(id: string, hash: string, payout: PayoutResult, execution: FinanceJobExecution): Promise<void> {
    await this.transactions.write(options(execution), async (context) => {
      const result = await this.access.database(context).query(
        `update finance.withdrawal set state=case when $5='failed' then 'failed' else state end,
        provider=$3,provider_reference=$4,provider_state=$5,response_hash=$6,evidence=evidence||$7::jsonb,
        updated_at=clock_timestamp(),version=version+1 where id=$1 and state='processing' and request_hash=$2
        and (provider is null or provider=$3) and (provider_reference is null or provider_reference=$4) returning id`,
        [id, hash, payout.provider, payout.reference, payout.state, payoutHashResult(payout), JSON.stringify({ payoutState: payout.state, payoutReference: payout.reference, payoutReason: payout.reason ?? null })]
      );
      if (!result.rows[0]) throw new Error('PAYOUT_RECEIPT_CONFLICT');
    });
  }
}

function payoutHash(withdrawal: Pick<WithdrawalRow, 'id' | 'scope_id' | 'settlement_id' | 'destination_ref' | 'amount_minor' | 'currency'>): string {
  return financeFingerprint(['payout-v1', withdrawal.id, withdrawal.scope_id, withdrawal.settlement_id, withdrawal.destination_ref, withdrawal.amount_minor, withdrawal.currency]);
}
function payoutHashResult(payout: PayoutResult): string {
  return financeFingerprint(['payout-result-v1', payout.provider, payout.reference, payout.state, payout.reason ?? '']);
}
function requiredHash(value: string | null): string {
  if (value === null) throw new Error('FINANCE_INPUT_WATERMARK_MISSING');
  return value;
}
function date(value: string | null): string {
  if (value === null) throw new Error('FINANCE_INPUT_WATERMARK_MISSING');
  return new Date(value).toISOString();
}
function options(execution: FinanceJobExecution) {
  return {
    tenant: execution.scope,
    membership: '',
    scope: execution.scope,
    actor: 'job:settlement',
    trace: execution.trace,
    operation: 'job.finance.settlement',
    workload: 'jobs' as const,
    signal: execution.signal,
    deadline: execution.deadline,
  };
}

interface WithdrawalRow {
  readonly id: string;
  readonly scope_id: string;
  readonly settlement_id: string;
  readonly destination_ref: string;
  readonly amount_minor: number;
  readonly currency: string;
  readonly state: string;
  readonly request_hash: string | null;
  readonly input_watermark: string | null;
  readonly provider: string | null;
  readonly provider_reference: string | null;
  readonly created_at: string;
  readonly version: number;
}
interface PayoutWithdrawal {
  readonly scope_id: string;
  readonly settlement_id: string;
  readonly partner_id: string;
  readonly amount_minor: number;
  readonly currency: string;
  readonly provider: string | null;
  readonly provider_reference: string | null;
}
