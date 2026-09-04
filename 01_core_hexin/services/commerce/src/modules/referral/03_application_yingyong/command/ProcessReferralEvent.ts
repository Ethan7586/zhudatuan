import { createHash } from 'node:crypto';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { FinancePort } from '../../../finance';
import { commissionAmount, commissionableBases, commissionRecipients, cumulativeRefundBases, cumulativeReversalAmount, type CommissionState, type LineRefund, type SettleTrigger } from '../../02_domain_yewu/policy/ReferralCommissionPolicy';

const SUPPORTED_EVENTS = new Set(['order.placed', 'order.paid', 'order.received', 'order.cancelled', 'payment.refunded']);

/** Handles one immutable order event inside the same transaction as its inbox acknowledgement. */
export class ProcessReferralEvent {
  private readonly finance = new FinancePort();

  constructor(private readonly pool: DatabasePool) {}

  async execute(envelope: Readonly<Record<string, unknown>>): Promise<void> {
    const eventId = text(envelope.eventId, 'EVENT_ID_REQUIRED');
    const event = text(envelope.event, 'EVENT_TYPE_REQUIRED');
    if (!SUPPORTED_EVENTS.has(event)) throw new Error('REFERRAL_EVENT_UNSUPPORTED');

    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const locked = await client.query<EventContext>(
        `select outbox.scope_id,outbox.occurred_at,outbox.payload
        from runtime.inbox inbox join runtime.outbox outbox on outbox.id=inbox.event_id
        where inbox.consumer='job:referral' and inbox.event_id=$1 and inbox.event_type=$2
          and outbox.event_type=$2 and inbox.payload=outbox.payload and inbox.processed_at is null
        for update of inbox`,
        [eventId, event]
      );
      const context = locked.rows[0];
      if (!context) {
        const complete = await client.query(
          `select 1 from runtime.inbox where consumer='job:referral'
          and event_id=$1 and event_type=$2 and processed_at is not null`,
          [eventId, event]
        );
        if (!complete.rows[0]) throw new Error('REFERRAL_EVENT_CONTEXT_MISSING');
        await client.query('commit');
        return;
      }

      const payload = object(context.payload);
      const orderId = text(payload.order, 'REFERRAL_ORDER_REFERENCE_REQUIRED');
      if (event !== 'order.placed') await this.requirePlaced(client, context.scope_id, orderId);
      if (event === 'order.placed') await this.place(client, context, eventId, payload);
      else if (event === 'order.paid') await this.trigger(client, context, eventId, payload, 'on_paid');
      else if (event === 'order.received') await this.trigger(client, context, eventId, payload, 'on_received');
      else if (event === 'order.cancelled') await this.cancel(client, context, eventId, payload);
      else await this.refund(client, context, eventId, payload);

      await client.query(
        `update runtime.inbox set processed_at=clock_timestamp(),attempts=attempts+1
        where consumer='job:referral' and event_id=$1 and event_type=$2`,
        [eventId, event]
      );
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
    }
  }

  private async requirePlaced(database: Database, scope: string, order: string): Promise<void> {
    const placed = await database.query(
      `select 1 from runtime.inbox inbox where inbox.consumer='job:referral'
        and inbox.event_type='order.placed' and inbox.processed_at is not null
        and inbox.event_id in(select outbox.id from runtime.outbox outbox
          where outbox.event_type='order.placed' and outbox.aggregate_type='order'
            and outbox.aggregate_id=$1 and outbox.scope_id=$2) limit 1`,
      [order, scope]
    );
    if (!placed.rows[0]) throw new Error('REFERRAL_ORDER_PLACED_NOT_PROCESSED');
  }

  private async place(database: Database, context: EventContext, eventId: string, payload: Readonly<Record<string, unknown>>): Promise<void> {
    const orderId = text(payload.order, 'REFERRAL_ORDER_REFERENCE_REQUIRED');
    const order = await this.order(database, orderId, context.scope_id);
    const setting = (
      await database.query<SettingFact>(
        `select enabled,reward_enabled,settle_trigger,settle_delay_days::float8 settle_delay_days,version::float8 version
        from referral.setting where scope_id=$1 for share`,
        [order.scope_id]
      )
    ).rows[0];
    if (!setting?.enabled) return;

    const binding = (
      await database.query<BindingFact>(
        `select direct.id referral_member_id,direct.member_id direct_member_id,inviter.member_id inviter_member_id
        from referral.binding binding join referral.member direct
          on direct.id=binding.referral_member_id and direct.scope_id=binding.scope_id and direct.state='active'
        left join referral.member inviter on inviter.id=direct.inviter_member_id
          and inviter.scope_id=direct.scope_id and inviter.state='active'
        where binding.scope_id=$1 and binding.customer_member_id=$2 and binding.bound_at<=$3::timestamptz
          and (binding.expires_at is null or binding.expires_at>$3::timestamptz)
        for share of binding,direct`,
        [order.scope_id, order.member_id, order.created_at]
      )
    ).rows[0];
    if (!binding || binding.direct_member_id === order.member_id) return;

    const lines = await database.query<LineFact>(
      `select line.id,line.sku_id,line.payable_minor::text payable_minor,
        coalesce(product.enabled,false) product_enabled,coalesce(product.commission_bps,0)::float8 commission_bps,
        coalesce(product.reward_bps,0)::float8 reward_bps,coalesce(product.version,0)::float8 product_version
      from ordering.line line left join referral.product product
        on product.scope_id=$2 and product.sku_id=line.sku_id
      where line.order_id=$1 order by line.id for share of line`,
      [order.id, order.scope_id]
    );
    const payableLines = lines.rows.map((line) => ({ id: line.id, amountMinor: minor(line.payable_minor, 'REFERRAL_LINE_AMOUNT_INVALID') }));
    const payableTotal = payableLines.reduce((sum, line) => sum + line.amountMinor, 0n);
    if (payableTotal !== minor(order.total_minor, 'REFERRAL_ORDER_AMOUNT_INVALID')) throw new Error('REFERRAL_ORDER_EVIDENCE_MISMATCH');
    const bases = new Map(commissionableBases(payableLines, minor(order.benefit_minor, 'REFERRAL_BENEFIT_AMOUNT_INVALID')).map((line) => [line.id, line.amountMinor]));

    for (const line of lines.rows) {
      if (!line.product_enabled) continue;
      const commissionBps = rate(line.commission_bps);
      const rewardBps = rate(line.reward_bps);
      if (commissionBps + rewardBps > 10_000) throw new Error('REFERRAL_RATE_TOTAL_INVALID');
      const baseMinor = bases.get(line.id) ?? 0n;
      for (const recipient of commissionRecipients({
        directMemberId: binding.direct_member_id,
        inviterMemberId: binding.inviter_member_id,
        rewardEnabled: setting.reward_enabled,
        commissionBps,
        rewardBps,
      })) {
        const amountMinor = commissionAmount(baseMinor, recipient.rateBps);
        if (amountMinor === 0n) continue;
        const commissionId = deterministicId('commission', order.scope_id, order.id, line.id, recipient.kind, recipient.beneficiaryMemberId);
        await database.query(
          `insert into referral.commission(id,scope_id,order_id,order_line_id,sku_id,beneficiary_member_id,kind,currency,
            base_minor,rate_bps,amount_minor,reversed_base_minor,reversed_minor,state,origin_event_id,setting_version,product_version,
            settle_trigger,settle_delay_days,eligible_at,journal_id,reversal_journal_id,reversal_event_id,settling_at,settled_at,reversed_at,
            created_at,updated_at,version)
          values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,0,'pending',$12,$13,$14,$15,$16,null,null,null,null,null,null,null,
            $17::timestamptz,$17::timestamptz,0)
          on conflict do nothing`,
          [
            commissionId,
            order.scope_id,
            order.id,
            line.id,
            line.sku_id,
            recipient.beneficiaryMemberId,
            recipient.kind,
            order.currency,
            safeNumber(baseMinor, 'REFERRAL_BASE_AMOUNT_OVERFLOW'),
            recipient.rateBps,
            safeNumber(amountMinor, 'REFERRAL_COMMISSION_AMOUNT_OVERFLOW'),
            eventId,
            setting.version,
            line.product_version,
            setting.settle_trigger,
            setting.settle_delay_days,
            context.occurred_at,
          ]
        );
      }
    }
  }

  private async trigger(database: Database, context: EventContext, eventId: string, payload: Readonly<Record<string, unknown>>, trigger: SettleTrigger): Promise<void> {
    const order = await this.order(database, text(payload.order, 'REFERRAL_ORDER_REFERENCE_REQUIRED'), context.scope_id);
    const evidenceValid = trigger === 'on_paid' ? ['paid', 'partially_refunded', 'refunded'].includes(order.payment_state) : ['delivered', 'returned'].includes(order.fulfillment_state);
    if (!evidenceValid) throw new Error('REFERRAL_TRIGGER_EVIDENCE_MISMATCH');

    const changed = await database.query<{ eligible_at: string }>(
      `update referral.commission set state='settling',
        eligible_at=$3::timestamptz+make_interval(days=>settle_delay_days),settling_at=$3::timestamptz,
        updated_at=clock_timestamp(),version=version+1
      where scope_id=$1 and order_id=$2 and state='pending' and settle_trigger=$4 and reversed_minor<amount_minor
      returning eligible_at::text eligible_at`,
      [order.scope_id, order.id, context.occurred_at, trigger]
    );
    const first = changed.rows.map((row) => row.eligible_at).sort()[0];
    if (first) await enqueueSettlement(database, order.scope_id, first, deterministicId('job:referral:settle', eventId));
  }

  private async cancel(database: Database, context: EventContext, eventId: string, payload: Readonly<Record<string, unknown>>): Promise<void> {
    const order = await this.order(database, text(payload.order, 'REFERRAL_ORDER_REFERENCE_REQUIRED'), context.scope_id);
    if (order.lifecycle_state !== 'cancelled' && order.fulfillment_state !== 'cancelled') throw new Error('REFERRAL_CANCELLATION_EVIDENCE_MISMATCH');
    const commissions = await this.commissions(database, order.scope_id, order.id);
    await this.reverse(
      database,
      context,
      eventId,
      null,
      commissions,
      new Map(
        commissions.map((row) => [
          row.id,
          {
            baseMinor: minor(row.base_minor, 'REFERRAL_BASE_AMOUNT_INVALID'),
            amountMinor: minor(row.amount_minor, 'REFERRAL_COMMISSION_AMOUNT_INVALID'),
          },
        ])
      )
    );
  }

  private async refund(database: Database, context: EventContext, eventId: string, payload: Readonly<Record<string, unknown>>): Promise<void> {
    const refundId = text(payload.refund, 'REFERRAL_REFUND_REFERENCE_REQUIRED');
    const refund = (
      await database.query<RefundHeader>(
        `select refund.id,intent.order_id,orders.scope_id,refund.state
        from payment.refund refund join payment.payment payment on payment.id=refund.payment_id
        join payment.intent intent on intent.id=payment.intent_id
        join ordering.orderrecord orders on orders.id=intent.order_id
        where refund.id=$1 for share of refund,orders`,
        [refundId]
      )
    ).rows[0];
    if (!refund || refund.scope_id !== context.scope_id || refund.state !== 'succeeded') throw new Error('REFERRAL_REFUND_EVIDENCE_MISMATCH');
    const order = await this.order(database, refund.order_id, context.scope_id);
    const lineResult = await database.query<{ id: string; payable_minor: string }>(`select id,payable_minor::text payable_minor from ordering.line where order_id=$1 order by id for share`, [order.id]);
    const payableLines = lineResult.rows.map((line) => ({ id: line.id, amountMinor: minor(line.payable_minor, 'REFERRAL_LINE_AMOUNT_INVALID') }));
    if (payableLines.reduce((sum, line) => sum + line.amountMinor, 0n) !== minor(order.total_minor, 'REFERRAL_ORDER_AMOUNT_INVALID')) {
      throw new Error('REFERRAL_ORDER_EVIDENCE_MISMATCH');
    }
    const bases = commissionableBases(payableLines, minor(order.benefit_minor, 'REFERRAL_BENEFIT_AMOUNT_INVALID'));
    const refundFacts = await database.query<RefundFact>(
      `select refund.id,aftersale.line_id,refund.amount_minor::text refund_minor,
        coalesce(sum(tender.amount_minor) filter(where tender.state='succeeded'),0)::text tender_minor,
        coalesce(sum(tender.amount_minor) filter(where tender.state='succeeded' and tender.kind<>'benefit'),0)::text included_minor
      from payment.refund refund join payment.payment payment on payment.id=refund.payment_id
      join payment.intent intent on intent.id=payment.intent_id
      left join ordering.aftersale aftersale on aftersale.id=refund.aftersale_id
      left join payment.refundtender tender on tender.refund_id=refund.id
      where intent.order_id=$1 and refund.state='succeeded'
      group by refund.id,aftersale.line_id order by refund.id`,
      [order.id]
    );
    const refunds: LineRefund[] = refundFacts.rows.map((fact) => {
      if (minor(fact.tender_minor, 'REFERRAL_REFUND_AMOUNT_INVALID') !== minor(fact.refund_minor, 'REFERRAL_REFUND_AMOUNT_INVALID')) {
        throw new Error('REFERRAL_REFUND_EVIDENCE_MISMATCH');
      }
      return { lineId: fact.line_id, amountMinor: minor(fact.included_minor, 'REFERRAL_REFUND_AMOUNT_INVALID') };
    });
    const refundedBases = cumulativeRefundBases(bases, refunds);
    const commissions = await this.commissions(database, order.scope_id, order.id);
    const desired = new Map<string, ReversalTarget>();
    for (const commission of commissions) {
      const baseMinor = minor(commission.base_minor, 'REFERRAL_BASE_AMOUNT_INVALID');
      const authoritativeBase = bases.find((line) => line.id === commission.order_line_id)?.amountMinor;
      if (authoritativeBase === undefined || authoritativeBase !== baseMinor) throw new Error('REFERRAL_COMMISSION_EVIDENCE_MISMATCH');
      const rateBps = rate(commission.rate_bps);
      if (commissionAmount(baseMinor, rateBps) !== minor(commission.amount_minor, 'REFERRAL_COMMISSION_AMOUNT_INVALID')) {
        throw new Error('REFERRAL_COMMISSION_EVIDENCE_MISMATCH');
      }
      const refundedBaseMinor = refundedBases.get(commission.order_line_id) ?? 0n;
      const reversedAmountMinor = cumulativeReversalAmount(baseMinor, rateBps, refundedBaseMinor);
      desired.set(commission.id, {
        baseMinor: reversedAmountMinor === minor(commission.amount_minor, 'REFERRAL_COMMISSION_AMOUNT_INVALID') ? baseMinor : refundedBaseMinor,
        amountMinor: reversedAmountMinor,
      });
    }
    await this.reverse(database, context, eventId, refundId, commissions, desired);
  }

  private async reverse(database: Database, context: EventContext, eventId: string, refundId: string | null, commissions: readonly CommissionFact[], desired: ReadonlyMap<string, ReversalTarget>): Promise<void> {
    for (const commission of commissions) {
      const baseMinor = minor(commission.base_minor, 'REFERRAL_BASE_AMOUNT_INVALID');
      const amountMinor = minor(commission.amount_minor, 'REFERRAL_COMMISSION_AMOUNT_INVALID');
      const currentBase = minor(commission.reversed_base_minor, 'REFERRAL_REVERSAL_AMOUNT_INVALID');
      const currentAmount = minor(commission.reversed_minor, 'REFERRAL_REVERSAL_AMOUNT_INVALID');
      const target = desired.get(commission.id) ?? { baseMinor: currentBase, amountMinor: currentAmount };
      if (target.baseMinor < currentBase || target.baseMinor > baseMinor || target.amountMinor < currentAmount || target.amountMinor > amountMinor) {
        throw new Error('REFERRAL_REVERSAL_AMOUNT_INVALID');
      }
      const deltaBase = target.baseMinor - currentBase;
      const deltaAmount = target.amountMinor - currentAmount;
      if (deltaAmount === 0n) continue;
      if (deltaBase <= 0n) throw new Error('REFERRAL_REVERSAL_AMOUNT_INVALID');

      const movementId = deterministicId('movement', eventId, commission.id, 'reversed');
      let journal: string | null = null;
      let recoveryJournal: string | null = null;
      let recoveryDelta = 0n;
      if (commission.state === 'settled') {
        const consumedMinor = await this.prepareReversalConsumption(database, commission, eventId);
        const netBefore = amountMinor - currentAmount;
        const netAfter = amountMinor - target.amountMinor;
        const currentRecovery = consumedMinor > netBefore ? consumedMinor - netBefore : 0n;
        const targetRecovery = consumedMinor > netAfter ? consumedMinor - netAfter : 0n;
        recoveryDelta = targetRecovery - currentRecovery;
        journal = await this.finance.post(database, {
          scope: commission.scope_id,
          referenceType: 'referral.commission.reversed',
          referenceId: movementId,
          currency: commission.currency,
          description: 'Referral commission reversal',
          debit: { code: `referral.commission.payable.${commission.beneficiary_member_id}`, kind: 'liability' },
          credit: { code: 'referral.commission.expense', kind: 'expense' },
          amountMinor: safeNumber(deltaAmount, 'REFERRAL_REVERSAL_AMOUNT_OVERFLOW'),
          occurredAt: context.occurred_at,
        });
        if (recoveryDelta > 0n) {
          recoveryJournal = await this.finance.post(database, {
            scope: commission.scope_id,
            referenceType: 'referral.commission.recovery.accrued',
            referenceId: deterministicId('recovery', movementId),
            currency: commission.currency,
            description: 'Referral commission recovery receivable',
            debit: { code: `referral.commission.receivable.${commission.beneficiary_member_id}`, kind: 'asset' },
            credit: { code: `referral.commission.payable.${commission.beneficiary_member_id}`, kind: 'liability' },
            amountMinor: safeNumber(recoveryDelta, 'REFERRAL_RECOVERY_AMOUNT_OVERFLOW'),
            occurredAt: context.occurred_at,
          });
        }
      }
      await database.query(
        `insert into referral.commissionmovement(id,scope_id,commission_id,beneficiary_member_id,origin_event_id,refund_id,
          kind,base_minor,amount_minor,journal_id,created_at)
        values($1,$2,$3,$4,$5,$6,'reversal',$7,$8,$9,$10::timestamptz) on conflict do nothing`,
        [
          movementId,
          commission.scope_id,
          commission.id,
          commission.beneficiary_member_id,
          eventId,
          refundId,
          safeNumber(deltaBase, 'REFERRAL_REVERSAL_AMOUNT_OVERFLOW'),
          safeNumber(deltaAmount, 'REFERRAL_REVERSAL_AMOUNT_OVERFLOW'),
          journal,
          context.occurred_at,
        ]
      );
      if (recoveryDelta > 0n) {
        await database.query(
          `insert into referral.recoverymovement(id,scope_id,beneficiary_member_id,kind,source_commission_id,
            settlement_commission_id,reversal_movement_id,recovery_id,origin_event_id,currency,amount_minor,journal_id,created_at)
          values($1,$2,$3,'accrual',$4,null,$5,null,$6,$7,$8,$9,$10::timestamptz) on conflict do nothing`,
          [
            deterministicId('recovery', movementId),
            commission.scope_id,
            commission.beneficiary_member_id,
            commission.id,
            movementId,
            eventId,
            commission.currency,
            safeNumber(recoveryDelta, 'REFERRAL_RECOVERY_AMOUNT_OVERFLOW'),
            recoveryJournal,
            context.occurred_at,
          ]
        );
      }
      const verified = (
        await database.query<{ reversed_base_minor: string; reversed_minor: string; state: CommissionState }>(
          `select reversed_base_minor::text reversed_base_minor,reversed_minor::text reversed_minor,state
          from referral.commission where id=$1 and scope_id=$2 for share`,
          [commission.id, commission.scope_id]
        )
      ).rows[0];
      const expectedState = target.baseMinor === baseMinor && target.amountMinor === amountMinor ? 'reversed' : commission.state;
      if (
        !verified ||
        minor(verified.reversed_base_minor, 'REFERRAL_REVERSAL_AMOUNT_INVALID') !== target.baseMinor ||
        minor(verified.reversed_minor, 'REFERRAL_REVERSAL_AMOUNT_INVALID') !== target.amountMinor ||
        verified.state !== expectedState
      ) {
        throw new Error('REFERRAL_REVERSAL_EVIDENCE_MISMATCH');
      }
    }
  }

  private async prepareReversalConsumption(database: Database, commission: Pick<CommissionFact, 'id' | 'scope_id'>, eventId: string): Promise<bigint> {
    await database.query(
      `update finance.withdrawal withdrawal set state='cancelled',
        evidence=withdrawal.evidence||jsonb_build_object('referralCancellation',
          jsonb_build_object('event',$3::text,'commission',$2::text)),
        updated_at=clock_timestamp(),version=withdrawal.version+1
      where withdrawal.scope_id=$1 and withdrawal.source_kind='referral'
        and withdrawal.state in('submitted','approved','failed')
        and exists(select 1 from referral.withdrawalclaim claim
          where claim.scope_id=withdrawal.scope_id and claim.withdrawal_id=withdrawal.id
            and claim.commission_id=$2)`,
      [commission.scope_id, commission.id, eventId]
    );
    const inFlight = await database.query(
      `select withdrawal.id from finance.withdrawal withdrawal
      where withdrawal.scope_id=$1 and withdrawal.source_kind='referral'
        and withdrawal.state in('processing','uncertain')
        and exists(select 1 from referral.withdrawalclaim claim
          where claim.scope_id=withdrawal.scope_id and claim.withdrawal_id=withdrawal.id
            and claim.commission_id=$2)
      for update of withdrawal`,
      [commission.scope_id, commission.id]
    );
    if (inFlight.rows[0]) throw new Error('REFERRAL_REVERSAL_WITHDRAWAL_IN_FLIGHT');
    const consumed = (
      await database.query<{ consumed_minor: string }>(
        `select (coalesce((select sum(claim.amount_minor) from referral.withdrawalclaim claim
          where claim.scope_id=$1 and claim.commission_id=$2 and claim.state='paid'),0)
          +coalesce((select sum(movement.amount_minor) from referral.recoverymovement movement
            where movement.scope_id=$1 and movement.kind='offset'
              and movement.settlement_commission_id=$2),0))::text consumed_minor`,
        [commission.scope_id, commission.id]
      )
    ).rows[0]?.consumed_minor;
    return minor(consumed ?? '0', 'REFERRAL_RECOVERY_AMOUNT_INVALID');
  }

  private async commissions(database: Database, scope: string, order: string): Promise<readonly CommissionFact[]> {
    const beneficiaries = await database.query<{ beneficiary_member_id: string }>(
      `select distinct beneficiary_member_id from referral.commission
      where scope_id=$1 and order_id=$2 order by beneficiary_member_id`,
      [scope, order]
    );
    const memberIds = beneficiaries.rows.map((row) => row.beneficiary_member_id);
    if (memberIds.length > 0) {
      const locked = await database.query(
        `select member_id from referral.member where scope_id=$1 and member_id=any($2::text[])
        order by member_id for update`,
        [scope, memberIds]
      );
      if (locked.rows.length !== memberIds.length) throw new Error('REFERRAL_MEMBER_LOCK_MISMATCH');
    }
    return (
      await database.query<CommissionFact>(
        `select id,scope_id,order_line_id,beneficiary_member_id,base_minor::text base_minor,rate_bps::float8 rate_bps,
          amount_minor::text amount_minor,reversed_base_minor::text reversed_base_minor,reversed_minor::text reversed_minor,
          currency,state
        from referral.commission where scope_id=$1 and order_id=$2 order by id for update`,
        [scope, order]
      )
    ).rows;
  }

  private async order(database: Database, orderId: string, scope: string): Promise<OrderFact> {
    const order = (
      await database.query<OrderFact>(
        `select orders.id,orders.scope_id,orders.member_id,orders.currency,orders.total_minor::text total_minor,
          orders.payment_state,orders.fulfillment_state,orders.lifecycle_state,orders.created_at::text created_at,
          coalesce((select sum(tender.amount_minor) from payment.intent intent join payment.intenttender tender on tender.intent_id=intent.id
            where intent.order_id=orders.id and tender.kind='benefit' and tender.state<>'released'),0)::text benefit_minor
        from ordering.orderrecord orders where orders.id=$1 for share of orders`,
        [orderId]
      )
    ).rows[0];
    if (!order || order.scope_id !== scope || order.currency !== 'CNY') throw new Error('REFERRAL_ORDER_EVIDENCE_MISMATCH');
    return order;
  }
}

interface EventContext extends Record<string, unknown> {
  readonly scope_id: string;
  readonly occurred_at: string;
  readonly payload: unknown;
}

interface OrderFact extends Record<string, unknown> {
  readonly id: string;
  readonly scope_id: string;
  readonly member_id: string;
  readonly currency: string;
  readonly total_minor: string;
  readonly benefit_minor: string;
  readonly payment_state: string;
  readonly fulfillment_state: string;
  readonly lifecycle_state: string;
  readonly created_at: string;
}

interface SettingFact extends Record<string, unknown> {
  readonly enabled: boolean;
  readonly reward_enabled: boolean;
  readonly settle_trigger: SettleTrigger;
  readonly settle_delay_days: number;
  readonly version: number;
}

interface BindingFact extends Record<string, unknown> {
  readonly referral_member_id: string;
  readonly direct_member_id: string;
  readonly inviter_member_id: string | null;
}

interface LineFact extends Record<string, unknown> {
  readonly id: string;
  readonly sku_id: string;
  readonly payable_minor: string;
  readonly product_enabled: boolean;
  readonly commission_bps: number;
  readonly reward_bps: number;
  readonly product_version: number;
}

interface RefundHeader extends Record<string, unknown> {
  readonly id: string;
  readonly order_id: string;
  readonly scope_id: string;
  readonly state: string;
}

interface RefundFact extends Record<string, unknown> {
  readonly id: string;
  readonly line_id: string | null;
  readonly refund_minor: string;
  readonly tender_minor: string;
  readonly included_minor: string;
}

interface CommissionFact extends Record<string, unknown> {
  readonly id: string;
  readonly scope_id: string;
  readonly order_line_id: string;
  readonly beneficiary_member_id: string;
  readonly base_minor: string;
  readonly rate_bps: number;
  readonly amount_minor: string;
  readonly reversed_base_minor: string;
  readonly reversed_minor: string;
  readonly currency: string;
  readonly state: CommissionState;
}

interface ReversalTarget {
  readonly baseMinor: bigint;
  readonly amountMinor: bigint;
}

interface Database {
  query<R extends Record<string, unknown> = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<Readonly<{ rows: readonly R[] }>>;
}

async function enqueueSettlement(database: Database, scope: string, availableAt: string, id: string): Promise<void> {
  await database.query(
    `insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
    values($1,'referral','referral',$2,jsonb_build_object('settleScope',$2::text),'queued',30,$3::timestamptz,clock_timestamp(),clock_timestamp())
    on conflict(id) do nothing`,
    [id, scope, availableAt]
  );
}

function deterministicId(prefix: string, ...parts: readonly string[]): string {
  return `${prefix}:${createHash('sha256').update(parts.join('\u001f')).digest('hex')}`;
}

function object(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Readonly<Record<string, unknown>>;
}

function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value) throw new Error(code);
  return value;
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

function rate(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 10_000) throw new Error('REFERRAL_RATE_INVALID');
  return value;
}
