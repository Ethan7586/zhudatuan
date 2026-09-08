import type { QueryResultRow } from 'pg';
import { PgOutbox } from '../../../../platform/database/PgOutbox';
import type { SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { TransactionManager } from '../../../../platform/database/TransactionManager';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ReferralFinancePort } from '../../../finance/public';
import type { ReferralProcessEvent } from '../../application/port/ReferralEventProcess';
import { ReverseCommissions } from '../../application/service/ReverseCommissions';
import { referralEvent } from '../../domain/event/ReferralEvents';
import { AttributionPolicy } from '../../domain/policy/AttributionPolicy';
import { CommissionPolicy } from '../../domain/policy/CommissionPolicy';
import { commissionableRefundAmount, deterministic, integer, optionalText, safeNumber, text } from './ReferralEventCodec';

interface CommissionRow extends QueryResultRow {
  readonly id: string;
  readonly order_line_id: string;
  readonly beneficiary_id: string;
  readonly amount_minor: number;
  readonly base_minor: number;
  readonly refunded_base_minor: number;
  readonly reversed_minor: number;
  readonly rate_basis_points: number;
  readonly currency: string;
  readonly state: string;
  readonly version: number;
}

export class PgReferralRefund {
  private readonly allocation = new CommissionPolicy();
  private readonly attribution = new AttributionPolicy();
  private readonly reversals: ReverseCommissions;
  private readonly outbox: PgOutbox;

  constructor(manager: TransactionManager, finance: ReferralFinancePort) {
    this.reversals = new ReverseCommissions(finance);
    this.outbox = new PgOutbox(manager);
  }

  async apply(context: WriteTransactionContext, transaction: SqlExecutor, input: ReferralProcessEvent, payload: Readonly<Record<string, unknown>>, occurredAt: string): Promise<void> {
    if (text(payload.order, 'REFERRAL_ORDER_REFERENCE_REQUIRED') !== input.resourceId) throw new Error('REFERRAL_ORDER_EVENT_MISMATCH');
    const refundId = text(payload.refund, 'REFERRAL_REFUND_REFERENCE_REQUIRED');
    const result = await transaction.query<CommissionRow>(
      `select id,order_line_id,beneficiary_id,amount_minor::float8 amount_minor,base_minor::float8 base_minor,
      refunded_base_minor::float8 refunded_base_minor,reversed_minor::float8 reversed_minor,rate_basis_points,currency,state,version
      from referral.commission where scope_id=$1 and order_id=$2 and ($3::text is null or order_line_id=$3)
      order by order_line_id,id for update`,
      [input.scopeId, input.resourceId, optionalText(payload.lineId)]
    );
    if (result.rows.length === 0) return;
    const totalMinor = integer(payload.amountMinor, 'REFERRAL_REFUND_AMOUNT_INVALID');
    const allocations = this.allocate(result.rows, commissionableRefundAmount(payload.tenders, totalMinor));
    for (const row of result.rows) await this.reverse(context, transaction, input, row, allocations.get(row.id) ?? 0n, refundId, occurredAt);
  }

  private allocate(rows: readonly CommissionRow[], refundedMinor: number) {
    return this.allocation.refundDeltas(
      rows.map((row) => ({ id: row.id, lineId: row.order_line_id, baseMinor: BigInt(row.base_minor), refundedBaseMinor: BigInt(row.refunded_base_minor) })),
      BigInt(refundedMinor)
    );
  }

  private async reverse(context: WriteTransactionContext, transaction: SqlExecutor, input: ReferralProcessEvent, row: CommissionRow, baseDelta: bigint, refundId: string, occurredAt: string) {
    if (baseDelta === 0n) return;
    const targetBase = BigInt(row.refunded_base_minor) + baseDelta;
    const targetAmount = this.attribution.refundReversal(BigInt(row.base_minor), targetBase, row.rate_basis_points);
    const amountDelta = targetAmount - BigInt(row.reversed_minor);
    if (amountDelta <= 0n) return;
    const movementKey = `reverse:${refundId}:${row.id}`;
    const journalId =
      row.state === 'settled' ? (await this.reversals.reverse(context, { businessKey: movementKey, scopeId: input.scopeId, beneficiaryId: row.beneficiary_id, amountMinor: amountDelta, currency: row.currency, occurredAt })).journalId : null;
    const movement = await transaction.query(
      `insert into referral.commissionmovement(id,movement_key,scope_id,commission_id,refund_id,direction,base_minor,
      amount_minor,reason,event_id,journal_id,created_at) values($1,$2,$3,$4,$5,'debit',$6,$7,'refund',$8,$9,$10::timestamptz)
      on conflict(movement_key) do nothing returning id`,
      [deterministic('commissionmovement', movementKey), movementKey, input.scopeId, row.id, refundId, safeNumber(baseDelta), safeNumber(amountDelta), input.eventId, journalId, occurredAt]
    );
    if (!movement.rows[0]) return;
    const updated = await transaction.query<{ version: number }>(
      `update referral.commission set refunded_base_minor=$2,reversed_minor=$3,state=case when $3=amount_minor then 'reversed' else state end,
      version=version+1,updated_at=clock_timestamp() where id=$1 and scope_id=$4 and version=$5 returning version`,
      [row.id, safeNumber(targetBase), safeNumber(targetAmount), input.scopeId, row.version]
    );
    const version = updated.rows[0]?.version;
    if (!version) throw new Error('REFERRAL_COMMISSION_VERSION_CONFLICT');
    await this.outbox.append(
      context,
      referralEvent({
        eventId: deterministic('event', input.eventId, row.id, 'reversed'),
        type: 'referral.commission.reversed',
        aggregateId: row.id,
        aggregateVersion: version,
        scopeId: input.scopeId,
        actorId: 'system:referral',
        correlationId: input.eventId,
        causationId: input.eventId,
        occurredAt,
        payload: { commissionId: row.id, reversalId: deterministic('commissionmovement', movementKey), amountMinor: safeNumber(amountDelta), currency: row.currency, reason: 'refund' },
      })
    );
  }
}
