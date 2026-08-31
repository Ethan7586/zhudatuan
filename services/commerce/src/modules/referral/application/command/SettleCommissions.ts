import { createHash } from 'node:crypto';
import type { QueryResultRow } from 'pg';
import { PgOutbox } from '../../../../adapter/database/PgOutbox';
import { PgUnitOfWork } from '../../../../adapter/database/PgUnitOfWork';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { Transaction } from '../../../../foundation/persistence/UnitOfWork';
import { referralEvent } from '../../domain/event/ReferralEvents';
import type { FinancePoster } from '../port/FinancePoster';
import type { Clock } from '../../../../foundation/domain/Clock';
import { SystemClock } from '../../../../foundation/domain/Clock';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { Commission, type CommissionState } from '../../domain/model/Commission';
import { Withdrawal } from '../../domain/model/Withdrawal';
import { SettlementPolicy } from '../../domain/policy/SettlementPolicy';

const BATCH = 100;

interface DueCommission extends QueryResultRow {
  readonly id: string;
  readonly beneficiary_id: string;
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

export class SettleCommissions {
  private readonly unit: PgUnitOfWork;
  private readonly outbox: PgOutbox;
  private readonly settlement = new SettlementPolicy();

  constructor(
    pool: DatabasePool,
    private readonly finance: FinancePoster,
    private readonly clock: Clock = SystemClock
  ) {
    this.unit = new PgUnitOfWork(pool.workload('worker'));
    this.outbox = new PgOutbox(pool.workload('worker'));
  }

  execute(scopeId: string, orderId: string | null): Promise<void> {
    if (!scopeId) throw new Error('REFERRAL_SCOPE_REQUIRED');
    return this.unit.execute({ tenant: scopeId, membership: '', scope: scopeId, actor: 'system:referral', trace: `referralsettlement:${scopeId}`, operation: 'referralsettlement', workload: 'worker' }, async (transaction) => {
      await transaction.query(`select pg_advisory_xact_lock(hashtextextended($1,0))`, [`referral:${scopeId}:${orderId ?? 'withdrawals'}`]);
      await this.commissions(transaction, scopeId, orderId);
      await this.withdrawals(transaction, scopeId);
      await reschedule(transaction, scopeId, orderId, this.clock.now().toISOString());
    });
  }

  private async commissions(transaction: Transaction, scopeId: string, orderId: string | null): Promise<void> {
    const due = await transaction.query<DueCommission>(
      `select id,beneficiary_id,order_id,amount_minor::float8 amount_minor,reversed_minor::float8 reversed_minor,currency,
      eligible_at,state,version from referral.commission where scope_id=$1 and state='available' and eligible_at<=clock_timestamp()
      and ($2::text is null or order_id=$2) order by eligible_at,id for update skip locked limit $3`,
      [scopeId, orderId, BATCH]
    );
    for (const commission of due.rows) {
      const model = new Commission(
        commission.id,
        this.settlement.deterministicKey(scopeId, commission.id, 'settle'),
        scopeId,
        String(commission.order_id),
        commission.beneficiary_id,
        BigInt(commission.amount_minor),
        commission.currency,
        commission.state,
        BigInt(commission.reversed_minor),
        commission.version
      );
      const eligibleAt = timestamp(commission.eligible_at);
      if (!this.settlement.eligible(model.state, eligibleAt, this.clock.now())) continue;
      const amount = model.money.amountMinor - model.reversedMinor;
      if (amount <= 0n) continue;
      const occurredAt = this.clock.now().toISOString();
      const businessKey = model.businessKey;
      const journal = await this.finance.post({
        businessKey,
        scopeId,
        beneficiaryId: model.beneficiaryId,
        kind: 'commission',
        amountMinor: amount,
        currency: model.money.currency,
        occurredAt,
      });
      const updated = await transaction.query<{ version: number }>(
        `update referral.commission set state='settled',settled_at=clock_timestamp(),settlement_journal_id=$2,
        version=version+1,updated_at=clock_timestamp() where id=$1 and scope_id=$3 and state='available' and version=$4 returning version`,
        [model.id, journal.journalId, model.scopeId, model.version]
      );
      const version = updated.rows[0]?.version;
      if (!version) throw new Error('REFERRAL_SETTLEMENT_CONFLICT');
      await this.outbox.append(
        transaction,
        referralEvent({
          eventId: deterministic('event', businessKey),
          type: 'referral.commission.settled',
          aggregateId: model.id,
          aggregateVersion: version,
          scopeId,
          actorId: 'system:referral',
          correlationId: businessKey,
          causationId: businessKey,
          occurredAt,
          payload: { commissionId: model.id, settledAt: occurredAt, amountMinor: Number(amount), currency: model.money.currency },
        })
      );
    }
  }

  private async withdrawals(transaction: Transaction, scopeId: string): Promise<void> {
    const claims = await transaction.query<DueWithdrawal>(
      `select id,member_id,amount_minor::float8 amount_minor,currency,account_ref,version from referral.withdrawalclaim
      where scope_id=$1 and state='requested' order by requested_at,id for update skip locked limit $2`,
      [scopeId, BATCH]
    );
    for (const claim of claims.rows) {
      const model = new Withdrawal(claim.id, scopeId, claim.member_id, BigInt(claim.amount_minor), claim.currency, claim.account_ref, 'requested', claim.version);
      const occurredAt = this.clock.now().toISOString();
      const businessKey = `withdrawal:${model.scopeId}:${model.id}`;
      const journal = await this.finance.post({
        businessKey,
        scopeId,
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
          version=version+1 where id=$1 and scope_id=$3 and state='requested' and version=$4 returning version
        ) insert into referral.recoverymovement(id,movement_key,scope_id,beneficiary_id,source_type,source_id,previous_state,
          next_state,direction,amount_minor,currency,actor_id,reason,journal_id,created_at)
        select $5,$6,$3,$7,'withdrawal',$1,'requested','paid','debit',$8,$9,'system:referral','settled',$2,clock_timestamp() from changed
        returning (select version from changed) version`,
        [model.id, journal.journalId, model.scopeId, model.version, movement, businessKey, model.memberId, Number(model.money.amountMinor), model.money.currency]
      );
      const version = updated.rows[0]?.version;
      if (!version) throw new DomainError('REFERRAL_WITHDRAWAL_CONFLICT');
      await this.outbox.append(
        transaction,
        referralEvent({
          eventId: deterministic('event', businessKey),
          type: 'referral.withdrawal.paid',
          aggregateId: model.id,
          aggregateVersion: version,
          scopeId,
          actorId: 'system:referral',
          correlationId: businessKey,
          causationId: businessKey,
          occurredAt,
          payload: { withdrawalId: model.id, providerReference: journal.journalId, paidAt: occurredAt },
        })
      );
    }
  }
}

async function reschedule(transaction: Transaction, scopeId: string, orderId: string | null, observedAt: string): Promise<void> {
  const remaining = await transaction.query<{ pending: boolean }>(
    `select exists(select 1 from referral.commission where scope_id=$1 and state='available' and eligible_at<=clock_timestamp()
      and ($2::text is null or order_id=$2)) or exists(select 1 from referral.withdrawalclaim where scope_id=$1 and state='requested') pending`,
    [scopeId, orderId]
  );
  if (!remaining.rows[0]?.pending) return;
  const nonce = deterministic('job', scopeId, orderId ?? 'withdrawals', observedAt);
  await transaction.query(
    `insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
    values($1,'referralsettlement','referral',$2,jsonb_build_object('scopeId',$2::text,'orderId',$3::text),
      'queued',30,clock_timestamp(),clock_timestamp(),clock_timestamp())`,
    [nonce, scopeId, orderId]
  );
}

function deterministic(kind: string, ...parts: readonly string[]): string {
  return `${kind}:${createHash('sha256').update(parts.join('\u0000')).digest('hex')}`;
}

function timestamp(value: Date | string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error('REFERRAL_TIMESTAMP_INVALID');
  return parsed.toISOString();
}
