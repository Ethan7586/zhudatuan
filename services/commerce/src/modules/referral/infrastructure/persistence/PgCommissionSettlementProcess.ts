import type { QueryResultRow } from 'pg';
import { PgOutbox } from '../../../../adapter/database/PgOutbox';
import { PgTransactionAccess, type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { referralEvent } from '../../domain/event/ReferralEvents';
import type { ReferralFinancePort } from '../../../finance/public';
import type { Clock } from '../../../../foundation/domain/Clock';
import { SystemClock } from '../../../../foundation/domain/Clock';
import { Commission, type CommissionState } from '../../domain/model/Commission';
import { Withdrawal } from '../../domain/model/Withdrawal';
import { SettlementPolicy } from '../../domain/policy/SettlementPolicy';
import type { CommissionKind } from '../../domain/policy/CommissionPolicy';
import type { CommissionSettlementProcess, SettlementReceipt } from '../../application/port/CommissionSettlementProcess';
import { deterministic, timestamp } from './ReferralEventCodec';
import { recordSettlementReceipt, settlementError } from './SettlementReceiptStore';

const BATCH = 100;

interface DueCommission extends QueryResultRow {
  readonly id: string;
  readonly business_key: string;
  readonly beneficiary_id: string;
  readonly kind: CommissionKind;
  readonly order_id: string;
  readonly order_line_id: string;
  readonly rule_id: string;
  readonly rule_version: number;
  readonly binding_id: string;
  readonly base_minor: number;
  readonly refunded_base_minor: number;
  readonly rate_basis_points: number;
  readonly amount_minor: number;
  readonly reversed_minor: number;
  readonly currency: string;
  readonly eligible_at: Date | string;
  readonly state: CommissionState;
  readonly version: number;
}

interface DueWithdrawal extends QueryResultRow {
  readonly id: string;
  readonly member_id: string;
  readonly amount_minor: number;
  readonly currency: string;
  readonly account_ref: string;
  readonly version: number;
}

export class PgCommissionSettlementProcess implements CommissionSettlementProcess {
  private readonly transactions = new PgTransactionAccess();
  private readonly outbox: PgOutbox;
  private readonly settlement = new SettlementPolicy();

  constructor(
    private readonly manager: TransactionManager,
    private readonly finance: ReferralFinancePort,
    private readonly clock: Clock = SystemClock
  ) {
    this.outbox = new PgOutbox(manager);
  }

  settle(scopeId: string, orderId: string | null, signal: AbortSignal, deadline: number) {
    if (!scopeId) throw new Error('REFERRAL_SCOPE_REQUIRED');
    return this.manager.write({ tenant: scopeId, membership: '', scope: scopeId, actor: 'system:referral', trace: `referralsettlement:${scopeId}`, operation: 'referralsettlement', workload: 'jobs', signal, deadline }, async (context) => {
      const transaction = this.transactions.database(context);
      await transaction.query(`select pg_advisory_xact_lock(hashtextextended($1,0))`, [`referral:${scopeId}:${orderId ?? 'withdrawals'}`]);
      const receipts = [...(await this.commissions(context, transaction, scopeId, orderId)), ...(await this.withdrawals(context, transaction, scopeId))];
      await reschedule(transaction, scopeId, orderId, this.clock.now().toISOString());
      return Object.freeze({ scopeId, items: Object.freeze(receipts) });
    });
  }

  private async commissions(context: WriteTransactionContext, transaction: SqlExecutor, scopeId: string, orderId: string | null): Promise<readonly SettlementReceipt[]> {
    const due = await transaction.query<DueCommission>(
      `select id,business_key,beneficiary_id,kind,order_id,order_line_id,rule_id,rule_version,binding_id,base_minor::float8 base_minor,
      refunded_base_minor::float8 refunded_base_minor,rate_basis_points,amount_minor::float8 amount_minor,reversed_minor::float8 reversed_minor,currency,
      eligible_at,state,version from referral.commission where scope_id=$1 and state='available' and eligible_at<=clock_timestamp()
      and ($2::text is null or order_id=$2) order by eligible_at,id for update skip locked limit $3`,
      [scopeId, orderId, BATCH]
    );
    const receipts: SettlementReceipt[] = [];
    for (const [index, commission] of due.rows.entries()) {
      const model = new Commission(
        commission.id,
        commission.business_key,
        scopeId,
        commission.order_id,
        commission.order_line_id,
        commission.rule_id,
        commission.rule_version,
        commission.binding_id,
        commission.beneficiary_id,
        commission.kind,
        BigInt(commission.base_minor),
        BigInt(commission.refunded_base_minor),
        commission.rate_basis_points,
        BigInt(commission.amount_minor),
        commission.currency,
        commission.state,
        BigInt(commission.reversed_minor),
        commission.version
      );
      const eligibleAt = timestamp(commission.eligible_at);
      if (!this.settlement.eligible(model.state, eligibleAt, this.clock.now())) {
        receipts.push(await recordSettlementReceipt(transaction, scopeId, 'commission', model.id, model.version, 'skipped', null, null));
        continue;
      }
      const amount = model.money.amountMinor - model.reversedMinor;
      if (amount <= 0n) {
        receipts.push(await recordSettlementReceipt(transaction, scopeId, 'commission', model.id, model.version, 'skipped', null, null));
        continue;
      }
      const savepoint = `commission_${index}`;
      await transaction.query(`savepoint ${savepoint}`);
      try {
        const reference = await this.settleCommission(context, transaction, model, amount);
        await transaction.query(`release savepoint ${savepoint}`);
        receipts.push(await recordSettlementReceipt(transaction, scopeId, 'commission', model.id, model.version, 'succeeded', reference, null));
      } catch (error) {
        await transaction.query(`rollback to savepoint ${savepoint}`);
        await transaction.query(`release savepoint ${savepoint}`);
        receipts.push(await recordSettlementReceipt(transaction, scopeId, 'commission', model.id, model.version, 'failed', null, settlementError(error)));
      }
    }
    return Object.freeze(receipts);
  }

  private async withdrawals(context: WriteTransactionContext, transaction: SqlExecutor, scopeId: string): Promise<readonly SettlementReceipt[]> {
    const claims = await transaction.query<DueWithdrawal>(
      `select id,member_id,amount_minor::float8 amount_minor,currency,account_ref,version from referral.withdrawalclaim
      where scope_id=$1 and state='processing' order by approved_at,id for update skip locked limit $2`,
      [scopeId, BATCH]
    );
    const receipts: SettlementReceipt[] = [];
    for (const [index, claim] of claims.rows.entries()) {
      const model = new Withdrawal(claim.id, scopeId, claim.member_id, BigInt(claim.amount_minor), claim.currency, claim.account_ref, 'processing', claim.version);
      const savepoint = `withdrawal_${index}`;
      await transaction.query(`savepoint ${savepoint}`);
      try {
        const reference = await this.settleWithdrawal(context, transaction, model);
        await transaction.query(`release savepoint ${savepoint}`);
        receipts.push(await recordSettlementReceipt(transaction, scopeId, 'withdrawal', model.id, model.version, 'succeeded', reference, null));
      } catch (error) {
        await transaction.query(`rollback to savepoint ${savepoint}`);
        await transaction.query(`release savepoint ${savepoint}`);
        receipts.push(await recordSettlementReceipt(transaction, scopeId, 'withdrawal', model.id, model.version, 'failed', null, settlementError(error)));
      }
    }
    return Object.freeze(receipts);
  }

  private async settleCommission(context: WriteTransactionContext, transaction: SqlExecutor, model: Commission, amount: bigint): Promise<string> {
    const occurredAt = this.clock.now().toISOString();
    const businessKey = this.settlement.deterministicKey(model.scopeId, model.id, 'settle');
    const journal = await this.finance.post(context, { businessKey, scopeId: model.scopeId, beneficiaryId: model.beneficiaryId, kind: 'commission', amountMinor: amount, currency: model.money.currency, occurredAt });
    const updated = await transaction.query<{ version: number }>(
      `update referral.commission set state='settled',settled_at=clock_timestamp(),settlement_journal_id=$2,
        version=version+1,updated_at=clock_timestamp() where id=$1 and scope_id=$3 and state='available' and version=$4 returning version`,
      [model.id, journal.journalId, model.scopeId, model.version]
    );
    const version = updated.rows[0]?.version;
    if (!version) throw new Error('REFERRAL_SETTLEMENT_CONFLICT');
    await this.outbox.append(
      context,
      referralEvent({
        eventId: deterministic('event', businessKey),
        type: 'referral.commission.settled',
        aggregateId: model.id,
        aggregateVersion: version,
        scopeId: model.scopeId,
        actorId: 'system:referral',
        correlationId: businessKey,
        causationId: businessKey,
        occurredAt,
        payload: { commissionId: model.id, settledAt: occurredAt, amountMinor: Number(amount), currency: model.money.currency },
      })
    );
    return journal.journalId;
  }

  private async settleWithdrawal(context: WriteTransactionContext, transaction: SqlExecutor, model: Withdrawal): Promise<string> {
    const occurredAt = this.clock.now().toISOString();
    const businessKey = `withdrawal:${model.scopeId}:${model.id}`;
    const journal = await this.finance.post(context, {
      businessKey,
      scopeId: model.scopeId,
      beneficiaryId: model.memberId,
      kind: 'withdrawal',
      amountMinor: model.money.amountMinor,
      currency: model.money.currency,
      occurredAt,
    });
    const movement = deterministic('recoverymovement', businessKey);
    const updated = await transaction.query<{ version: number }>(
      `with changed as (
          update referral.withdrawalclaim set state='paid',completed_at=clock_timestamp(),provider_reference=$2,
          version=version+1 where id=$1 and scope_id=$3 and state='processing' and version=$4 returning version
        ) insert into referral.recoverymovement(id,movement_key,scope_id,beneficiary_id,source_type,source_id,previous_state,
          next_state,direction,amount_minor,currency,actor_id,reason,journal_id,created_at)
        select $5,$6,$3,$7,'withdrawal',$1,'processing','paid','debit',$8,$9,'system:referral','settled',$2,clock_timestamp() from changed
        returning (select version from changed) version`,
      [model.id, journal.journalId, model.scopeId, model.version, movement, businessKey, model.memberId, Number(model.money.amountMinor), model.money.currency]
    );
    const version = updated.rows[0]?.version;
    if (!version) throw new Error('REFERRAL_WITHDRAWAL_SETTLEMENT_CONFLICT');
    await this.outbox.append(
      context,
      referralEvent({
        eventId: deterministic('event', businessKey),
        type: 'referral.withdrawal.paid',
        aggregateId: model.id,
        aggregateVersion: version,
        scopeId: model.scopeId,
        actorId: 'system:referral',
        correlationId: businessKey,
        causationId: businessKey,
        occurredAt,
        payload: { withdrawalId: model.id, providerReference: journal.journalId, paidAt: occurredAt },
      })
    );
    return journal.journalId;
  }
}

async function reschedule(transaction: SqlExecutor, scopeId: string, orderId: string | null, observedAt: string): Promise<void> {
  const remaining = await transaction.query<{ pending: boolean }>(
    `select exists(select 1 from referral.commission where scope_id=$1 and state='available' and eligible_at<=clock_timestamp()
      and ($2::text is null or order_id=$2)) or exists(select 1 from referral.withdrawalclaim where scope_id=$1 and state='processing') pending`,
    [scopeId, orderId]
  );
  if (!remaining.rows[0]?.pending) return;
  const nonce = deterministic('job', scopeId, orderId ?? 'withdrawals', observedAt);
  await new PgRuntimeWriter(transaction).schedule({ id: nonce, kind: 'referralsettlement', owner: 'referral', scope: scopeId, payload: { scopeId, orderId }, priority: 30 });
}
