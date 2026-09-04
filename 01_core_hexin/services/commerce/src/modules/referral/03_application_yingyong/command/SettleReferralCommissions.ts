import { createHash, randomUUID } from 'node:crypto';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { FinancePort } from '../../../finance';

const BATCH_SIZE = 100;

/** Posts eligible commission liabilities and records the immutable accounting movement. */
export class SettleReferralCommissions {
  private readonly finance = new FinancePort();

  constructor(private readonly pool: DatabasePool) {}

  async execute(scope: string): Promise<void> {
    if (!scope) throw new Error('REFERRAL_SCOPE_REQUIRED');
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const members = await client.query<{ member_id: string }>(
        `select member.member_id from referral.member member
        where member.scope_id=$1 and exists(
          select 1 from referral.commission commission
          where commission.scope_id=member.scope_id and commission.beneficiary_member_id=member.member_id
            and commission.state='settling' and commission.eligible_at<=clock_timestamp()
            and commission.reversed_minor<commission.amount_minor)
        order by member.member_id for update of member skip locked limit $2`,
        [scope, BATCH_SIZE]
      );
      const memberIds = members.rows.map((member) => member.member_id);
      const eligible = await client.query<EligibleCommission>(
        `select id,scope_id,beneficiary_member_id,amount_minor::text amount_minor,
          reversed_minor::text reversed_minor,currency,origin_event_id,eligible_at::text eligible_at
        from referral.commission where scope_id=$1 and state='settling' and eligible_at<=clock_timestamp()
          and reversed_minor<amount_minor and beneficiary_member_id=any($2::text[])
        order by beneficiary_member_id,eligible_at,id for update skip locked limit $3`,
        [scope, memberIds, BATCH_SIZE]
      );

      for (const commission of eligible.rows) {
        if (commission.scope_id !== scope) throw new Error('REFERRAL_SCOPE_MISMATCH');
        const amountMinor = minor(commission.amount_minor, 'REFERRAL_COMMISSION_AMOUNT_INVALID');
        const reversedMinor = minor(commission.reversed_minor, 'REFERRAL_REVERSAL_AMOUNT_INVALID');
        if (reversedMinor >= amountMinor) throw new Error('REFERRAL_COMMISSION_EVIDENCE_MISMATCH');
        const payable = amountMinor - reversedMinor;
        const journal = await this.finance.post(client, {
          scope,
          referenceType: 'referral.commission.accrued',
          referenceId: commission.id,
          currency: commission.currency,
          description: 'Referral commission accrual',
          debit: { code: 'referral.commission.expense', kind: 'expense' },
          credit: { code: `referral.commission.payable.${commission.beneficiary_member_id}`, kind: 'liability' },
          amountMinor: safeNumber(payable, 'REFERRAL_COMMISSION_AMOUNT_OVERFLOW'),
          occurredAt: commission.eligible_at,
        });
        await this.offsetRecovery(client, commission, payable);
        const updated = await client.query(
          `update referral.commission set state='settled',journal_id=$2,settled_at=clock_timestamp(),updated_at=clock_timestamp(),version=version+1
          where id=$1 and scope_id=$3 and state='settling' and journal_id is null returning id`,
          [commission.id, journal, scope]
        );
        if (!updated.rows[0]) throw new Error('REFERRAL_SETTLEMENT_CONFLICT');
      }

      const next = (
        await client.query<{ eligible_at: string }>(
          `select min(eligible_at)::text eligible_at from referral.commission
          where scope_id=$1 and state='settling' and reversed_minor<amount_minor having count(*)>0`,
          [scope]
        )
      ).rows[0]?.eligible_at;
      if (next) {
        await client.query(
          `insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
          values($1,'referral','referral',$2,jsonb_build_object('settleScope',$2::text),'queued',30,
            greatest(clock_timestamp(),$3::timestamptz),clock_timestamp(),clock_timestamp())`,
          [`job:referral:settle:${randomUUID()}`, scope, next]
        );
      }
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
    }
  }

  private async offsetRecovery(database: SettlementDatabase, commission: EligibleCommission, payable: bigint): Promise<void> {
    const recoveries = await database.query<RecoveryAccrual>(
      `select recovery.id,recovery.source_commission_id,recovery.amount_minor::text amount_minor,
        (recovery.amount_minor-coalesce((select sum(offset.amount_minor)
          from referral.recoverymovement offset where offset.scope_id=recovery.scope_id
            and offset.kind='offset' and offset.recovery_id=recovery.id),0))::text outstanding_minor
      from referral.recoverymovement recovery
      where recovery.scope_id=$1 and recovery.beneficiary_member_id=$2 and recovery.currency=$3
        and recovery.kind='accrual' and recovery.amount_minor>coalesce((select sum(offset.amount_minor)
          from referral.recoverymovement offset where offset.scope_id=recovery.scope_id
            and offset.kind='offset' and offset.recovery_id=recovery.id),0)
      order by recovery.created_at,recovery.id for update of recovery`,
      [commission.scope_id, commission.beneficiary_member_id, commission.currency]
    );
    let remaining = payable;
    for (const recovery of recoveries.rows) {
      if (remaining === 0n) break;
      const outstanding = minor(recovery.outstanding_minor, 'REFERRAL_RECOVERY_AMOUNT_INVALID');
      if (outstanding === 0n) continue;
      const amount = outstanding < remaining ? outstanding : remaining;
      const movementId = deterministicId('recovery-offset', commission.id, recovery.id);
      const journal = await this.finance.post(database, {
        scope: commission.scope_id,
        referenceType: 'referral.commission.recovery.offset',
        referenceId: movementId,
        currency: commission.currency,
        description: 'Referral commission recovery offset',
        debit: { code: `referral.commission.payable.${commission.beneficiary_member_id}`, kind: 'liability' },
        credit: { code: `referral.commission.receivable.${commission.beneficiary_member_id}`, kind: 'asset' },
        amountMinor: safeNumber(amount, 'REFERRAL_RECOVERY_AMOUNT_OVERFLOW'),
        occurredAt: commission.eligible_at,
      });
      await database.query(
        `insert into referral.recoverymovement(id,scope_id,beneficiary_member_id,kind,source_commission_id,
          settlement_commission_id,reversal_movement_id,recovery_id,origin_event_id,currency,amount_minor,journal_id,created_at)
        values($1,$2,$3,'offset',$4,$5,null,$6,$7,$8,$9,$10,$11::timestamptz) on conflict do nothing`,
        [
          movementId,
          commission.scope_id,
          commission.beneficiary_member_id,
          recovery.source_commission_id,
          commission.id,
          recovery.id,
          commission.origin_event_id,
          commission.currency,
          safeNumber(amount, 'REFERRAL_RECOVERY_AMOUNT_OVERFLOW'),
          journal,
          commission.eligible_at,
        ]
      );
      remaining -= amount;
    }
  }
}

interface EligibleCommission extends Record<string, unknown> {
  readonly id: string;
  readonly scope_id: string;
  readonly beneficiary_member_id: string;
  readonly amount_minor: string;
  readonly reversed_minor: string;
  readonly currency: string;
  readonly origin_event_id: string;
  readonly eligible_at: string;
}

interface RecoveryAccrual extends Record<string, unknown> {
  readonly id: string;
  readonly source_commission_id: string;
  readonly amount_minor: string;
  readonly outstanding_minor: string;
}

interface SettlementDatabase {
  query<R extends Record<string, unknown> = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<Readonly<{ rows: readonly R[] }>>;
}

function minor(value: unknown, code: string): bigint {
  try {
    const parsed = typeof value === 'bigint' ? value : typeof value === 'number' && Number.isSafeInteger(value) ? BigInt(value) : typeof value === 'string' && /^\d+$/.test(value) ? BigInt(value) : -1n;
    if (parsed < 0n) throw new Error(code);
    return parsed;
  } catch {
    throw new Error(code);
  }
}

function safeNumber(value: bigint, code: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(code);
  return Number(value);
}

function deterministicId(kind: string, ...parts: readonly string[]): string {
  return `referral-${kind}:${createHash('sha256').update(parts.join('\u0000')).digest('hex')}`;
}
