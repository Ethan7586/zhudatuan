import type { QueryResultRow } from 'pg';
import { PgOutbox } from '../../../../adapter/database/PgOutbox';
import { PgUnitOfWork } from '../../../../adapter/database/PgUnitOfWork';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { Transaction } from '../../../../foundation/persistence/UnitOfWork';
import { referralEvent } from '../../domain/event/ReferralEvents';
import { Commission } from '../../domain/model/Commission';
import { CommissionPolicy } from '../../domain/policy/CommissionPolicy';
import { ReferralRate } from '../../domain/value/ReferralRate';
import type { FinancePoster } from '../port/FinancePoster';
import { array, assertEvent, deterministic, enqueueSettlement, integer, object, optionalText, orderLine, safeNumber, text, timestamp } from './ReferralEventSupport';
import { ReverseCommissions } from './ReverseCommissions';

interface InboxRow extends QueryResultRow {
  readonly payload: unknown;
  readonly occurred_at: Date | string;
  readonly processed_at: Date | string | null;
}

interface SettingRow extends QueryResultRow {
  readonly enabled: boolean;
  readonly rate_basis_points: number;
  readonly currency: string;
}

interface BindingRow extends QueryResultRow {
  readonly beneficiary_id: string;
}

interface ProductRow extends QueryResultRow {
  readonly product_id: string;
  readonly enabled: boolean;
  readonly rate_basis_points: number;
}

interface CommissionRow extends QueryResultRow {
  readonly id: string;
  readonly beneficiary_id: string;
  readonly order_line_id: string;
  readonly amount_minor: number;
  readonly base_minor: number;
  readonly refunded_base_minor: number;
  readonly reversed_minor: number;
  readonly rate_basis_points: number;
  readonly currency: string;
  readonly state: string;
  readonly version: number;
}

export interface ReferralOrderEvent {
  readonly eventId: string;
  readonly eventType: 'order.paid' | 'order.received' | 'refund.completed';
  readonly scopeId: string;
  readonly orderId: string;
}

/** Consumes an immutable order fact and mutates only Referral-owned state. */
export class ProcessOrderEvent {
  private readonly unit: PgUnitOfWork;
  private readonly outbox: PgOutbox;
  private readonly commissions = new CommissionPolicy();
  private readonly reversals: ReverseCommissions;

  constructor(
    pool: DatabasePool,
    private readonly finance: FinancePoster
  ) {
    this.unit = new PgUnitOfWork(pool.workload('worker'));
    this.outbox = new PgOutbox(pool.workload('worker'));
    this.reversals = new ReverseCommissions(finance);
  }

  execute(input: ReferralOrderEvent): Promise<void> {
    assertEvent(input);
    return this.unit.execute({ tenant: input.scopeId, membership: '', scope: input.scopeId, actor: 'system:referral', trace: input.eventId, operation: 'referralevent', workload: 'worker' }, async (transaction) => {
      await transaction.query(`select pg_advisory_xact_lock(hashtextextended($1,0))`, [`referral:${input.scopeId}:${input.orderId}`]);
      const inbox = (
        await transaction.query<InboxRow>(
          `select inbox.payload,inbox.processed_at,outbox.occurred_at
            from runtime.inbox inbox join runtime.outbox outbox on outbox.id=inbox.event_id
            where inbox.consumer='job:referralevent' and inbox.event_id=$1 and inbox.event_type=$2
              and outbox.scope_id=$3 and outbox.aggregate_id=$4 for update of inbox`,
          [input.eventId, input.eventType, input.scopeId, input.orderId]
        )
      ).rows[0];
      if (!inbox) throw new Error('REFERRAL_EVENT_CONTEXT_MISSING');
      if (inbox.processed_at !== null) return;
      const payload = object(inbox.payload, 'REFERRAL_EVENT_PAYLOAD_INVALID');
      const occurredAt = timestamp(inbox.occurred_at);
      if (input.eventType === 'order.paid') await this.paid(transaction, input, payload, occurredAt);
      if (input.eventType === 'order.received') await this.received(transaction, input, payload, occurredAt);
      if (input.eventType === 'refund.completed') await this.refunded(transaction, input, payload, occurredAt);
      const completed = await transaction.query(
        `update runtime.inbox set processed_at=clock_timestamp(),attempts=attempts+1
          where consumer='job:referralevent' and event_id=$1 and event_type=$2 and processed_at is null`,
        [input.eventId, input.eventType]
      );
      if (completed.rowCount !== 1) throw new Error('REFERRAL_INBOX_CONFLICT');
    });
  }

  private async paid(transaction: Transaction, input: ReferralOrderEvent, payload: Readonly<Record<string, unknown>>, occurredAt: string): Promise<void> {
    const snapshot = object(payload.snapshot, 'REFERRAL_ORDER_SNAPSHOT_REQUIRED');
    if (text(snapshot.order, 'REFERRAL_ORDER_REFERENCE_REQUIRED') !== input.orderId) throw new Error('REFERRAL_ORDER_SNAPSHOT_MISMATCH');
    const memberId = text(snapshot.member, 'REFERRAL_MEMBER_REFERENCE_REQUIRED');
    const currency = text(snapshot.currency, 'REFERRAL_CURRENCY_REQUIRED');
    const setting = (await transaction.query<SettingRow>(`select enabled,rate_basis_points,currency from referral.setting where scope_id=$1 for share`, [input.scopeId])).rows[0];
    if (!setting?.enabled) return;
    if (setting.currency !== currency) throw new Error('REFERRAL_CURRENCY_MISMATCH');
    const binding = (
      await transaction.query<BindingRow>(
        `select member.member_id beneficiary_id from referral.binding binding
        join referral.member member on member.id=binding.promoter_id and member.scope_id=binding.scope_id and member.state='active'
        where binding.scope_id=$1 and binding.customer_id=$2 for share of binding,member`,
        [input.scopeId, memberId]
      )
    ).rows[0];
    if (!binding || binding.beneficiary_id === memberId) return;
    const lines = array(snapshot.lines, 'REFERRAL_ORDER_LINES_REQUIRED').map(orderLine);
    const productIds = [...new Set(lines.map(({ productId }) => productId))];
    const products = await transaction.query<ProductRow>(
      `select product_id,enabled,rate_basis_points from referral.product
      where scope_id=$1 and product_id=any($2::text[]) for share`,
      [input.scopeId, productIds]
    );
    const configured = new Map(products.rows.map((product) => [product.product_id, product]));
    for (const line of lines) {
      const product = configured.get(line.productId);
      if (!product?.enabled) continue;
      const rate = product.rate_basis_points > 0 ? product.rate_basis_points : setting.rate_basis_points;
      const amountMinor = new ReferralRate(rate).apply(BigInt(line.payableMinor));
      if (amountMinor === 0n) continue;
      const businessKey = `commission:${input.scopeId}:${input.orderId}:${line.lineId}:${binding.beneficiary_id}`;
      const id = deterministic('referralcommission', businessKey);
      const commission = new Commission(id, businessKey, input.scopeId, input.orderId, binding.beneficiary_id, amountMinor, currency, 'pending', 0n, 1);
      const inserted = await transaction.query<{ id: string; version: number }>(
        `insert into referral.commission(id,business_key,scope_id,order_id,order_line_id,product_id,beneficiary_id,
          base_minor,refunded_base_minor,amount_minor,rate_basis_points,currency,reversed_minor,state,origin_event_id,
          eligible_at,version,created_at,updated_at)
        values($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10,$11,0,'pending',$12,null,1,$13::timestamptz,$13::timestamptz)
        on conflict(business_key) do nothing returning id,version`,
        [
          commission.id,
          commission.businessKey,
          commission.scopeId,
          commission.orderId,
          line.lineId,
          line.productId,
          commission.beneficiaryId,
          line.payableMinor,
          safeNumber(commission.money.amountMinor),
          rate,
          commission.money.currency,
          input.eventId,
          occurredAt,
        ]
      );
      if (!inserted.rows[0]) continue;
      await this.outbox.append(
        transaction,
        referralEvent({
          eventId: deterministic('event', input.eventId, id, 'created'),
          type: 'referral.commission.created',
          aggregateId: commission.id,
          aggregateVersion: 1,
          scopeId: input.scopeId,
          actorId: 'system:referral',
          correlationId: input.eventId,
          causationId: input.eventId,
          occurredAt,
          payload: { commissionId: commission.id, orderId: commission.orderId, amountMinor: safeNumber(commission.money.amountMinor), currency: commission.money.currency },
        })
      );
    }
  }

  private async received(transaction: Transaction, input: ReferralOrderEvent, payload: Readonly<Record<string, unknown>>, occurredAt: string): Promise<void> {
    if (text(payload.orderId, 'REFERRAL_ORDER_REFERENCE_REQUIRED') !== input.orderId) throw new Error('REFERRAL_ORDER_EVENT_MISMATCH');
    if (text(payload.fulfillmentState, 'REFERRAL_FULFILLMENT_STATE_REQUIRED') !== 'received') throw new Error('REFERRAL_RECEIPT_EVIDENCE_INVALID');
    const changed = await transaction.query(
      `update referral.commission set state='available',eligible_at=$3::timestamptz,version=version+1,updated_at=clock_timestamp()
      where scope_id=$1 and order_id=$2 and state='pending' and reversed_minor<amount_minor returning id`,
      [input.scopeId, input.orderId, occurredAt]
    );
    if ((changed.rowCount ?? 0) > 0) await enqueueSettlement(transaction, input.scopeId, input.orderId, occurredAt);
  }

  private async refunded(transaction: Transaction, input: ReferralOrderEvent, payload: Readonly<Record<string, unknown>>, occurredAt: string): Promise<void> {
    if (text(payload.order, 'REFERRAL_ORDER_REFERENCE_REQUIRED') !== input.orderId) throw new Error('REFERRAL_ORDER_EVENT_MISMATCH');
    const refundId = text(payload.refund, 'REFERRAL_REFUND_REFERENCE_REQUIRED');
    const refundedMinor = integer(payload.amountMinor, 'REFERRAL_REFUND_AMOUNT_INVALID');
    const lineId = optionalText(payload.lineId);
    const result = await transaction.query<CommissionRow>(
      `select id,beneficiary_id,order_line_id,amount_minor::float8 amount_minor,base_minor::float8 base_minor,
      refunded_base_minor::float8 refunded_base_minor,reversed_minor::float8 reversed_minor,rate_basis_points,currency,state,version
      from referral.commission where scope_id=$1 and order_id=$2
        and ($3::text is null or order_line_id=$3) order by order_line_id,id for update`,
      [input.scopeId, input.orderId, lineId]
    );
    const rows = result.rows;
    if (rows.length === 0) return;
    const allocations = this.commissions.allocate(
      rows.map((row) => ({ id: row.id, amountMinor: BigInt(row.base_minor - row.refunded_base_minor) })),
      BigInt(
        Math.min(
          refundedMinor,
          rows.reduce((sum, row) => sum + row.base_minor - row.refunded_base_minor, 0)
        )
      ),
      10_000
    );
    for (const row of rows) {
      const baseDelta = allocations.get(row.id) ?? 0n;
      if (baseDelta === 0n) continue;
      const targetBase = BigInt(row.refunded_base_minor) + baseDelta;
      const targetAmount = new ReferralRate(row.rate_basis_points).apply(targetBase);
      const amountDelta = targetAmount - BigInt(row.reversed_minor);
      if (amountDelta <= 0n) continue;
      const movementKey = `reverse:${refundId}:${row.id}`;
      let journalId: string | null = null;
      if (row.state === 'settled') {
        journalId = (
          await this.reversals.reverse({
            businessKey: movementKey,
            scopeId: input.scopeId,
            beneficiaryId: row.beneficiary_id,
            amountMinor: amountDelta,
            currency: row.currency,
            occurredAt,
          })
        ).journalId;
      }
      const movement = await transaction.query(
        `insert into referral.commissionmovement(id,movement_key,scope_id,commission_id,refund_id,direction,base_minor,
          amount_minor,reason,event_id,journal_id,created_at)
        values($1,$2,$3,$4,$5,'debit',$6,$7,'refund',$8,$9,$10::timestamptz)
        on conflict(movement_key) do nothing returning id`,
        [deterministic('commissionmovement', movementKey), movementKey, input.scopeId, row.id, refundId, safeNumber(baseDelta), safeNumber(amountDelta), input.eventId, journalId, occurredAt]
      );
      if (!movement.rows[0]) continue;
      const updated = await transaction.query<{ version: number }>(
        `update referral.commission set refunded_base_minor=$2,reversed_minor=$3,
          state=case when $3=amount_minor then 'reversed' else state end,version=version+1,updated_at=clock_timestamp()
        where id=$1 and scope_id=$4 and version=$5 returning version`,
        [row.id, safeNumber(targetBase), safeNumber(targetAmount), input.scopeId, row.version]
      );
      const version = updated.rows[0]?.version;
      if (!version) throw new Error('REFERRAL_COMMISSION_VERSION_CONFLICT');
      await this.outbox.append(
        transaction,
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
}
