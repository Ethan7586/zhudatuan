import { PgOutbox } from '../../../../platform/database/PgOutbox';
import { PgTransactionAccess, type SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import type { TransactionManager } from '../../../../platform/database/TransactionManager';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { referralEvent } from '../../domain/event/ReferralEvents';
import { Commission } from '../../domain/model/Commission';
import { ReferralRate } from '../../domain/value/ReferralRate';
import type { ReferralFinancePort } from '../../../finance/public';
import type { ReferralEventProcess, ReferralProcessEvent } from '../../application/port/ReferralEventProcess';
import { array, assertEvent, benefitAmount, deterministic, enqueueSettlement, integer, object, orderLine, safeNumber, text, timestamp } from './ReferralEventCodec';
import type { ApprovalReadPort } from '../../../approval/public';
import { WithdrawalPolicy } from '../../domain/policy/WithdrawalPolicy';
import { SettlementPolicy } from '../../domain/policy/SettlementPolicy';
import { CommissionPolicy } from '../../domain/policy/CommissionPolicy';
import { PgReferralRefund } from './PgReferralRefund';
import type { ReferralBindingRow, ReferralProductRow, ReferralSettingRow } from './ReferralEventRows';

/** Consumes an immutable order fact and mutates only Referral-owned state. */
export class PgReferralEventProcess implements ReferralEventProcess {
  private readonly transactions = new PgTransactionAccess();
  private readonly outbox: PgOutbox;
  private readonly refunds: PgReferralRefund;
  private readonly withdrawals = new WithdrawalPolicy();
  private readonly settlement = new SettlementPolicy();
  private readonly commissions = new CommissionPolicy();

  constructor(
    private readonly manager: TransactionManager,
    private readonly finance: ReferralFinancePort,
    private readonly approvals: ApprovalReadPort
  ) {
    this.outbox = new PgOutbox(manager);
    this.refunds = new PgReferralRefund(manager, finance);
  }

  process(input: ReferralProcessEvent, signal: AbortSignal, deadline: number): Promise<void> {
    assertEvent(input);
    return this.manager.write({ tenant: input.scopeId, membership: '', scope: input.scopeId, actor: 'system:referral', trace: input.eventId, operation: 'referralevent', workload: 'jobs', signal, deadline }, async (context) => {
      const transaction = this.transactions.database(context);
      await transaction.query(`select pg_advisory_xact_lock(hashtextextended($1,0))`, [`referral:${input.scopeId}:${input.resourceId}`]);
      const runtime = new PgRuntimeWriter(transaction);
      const inbox = await runtime.claim('job:referralevent', input.eventId);
      if (!inbox) throw new Error('REFERRAL_EVENT_CONTEXT_MISSING');
      if (inbox.type !== input.eventType || inbox.version !== 1 || inbox.scope !== input.scopeId || inbox.aggregate !== input.sourceId) throw new Error('REFERRAL_EVENT_CONTEXT_MISMATCH');
      const payload = object(inbox.payload, 'REFERRAL_EVENT_PAYLOAD_INVALID');
      const occurredAt = timestamp(inbox.occurredAt);
      if (input.eventType === 'order.paid') await this.paid(context, transaction, input, payload, occurredAt);
      if (input.eventType === 'order.received') await this.received(transaction, input, payload, occurredAt);
      if (input.eventType === 'refund.completed') await this.refunds.apply(context, transaction, input, payload, occurredAt);
      if (input.eventType === 'approval.instance.approved') await this.approved(context, transaction, input, payload, occurredAt);
      if (!(await runtime.completeInbox('job:referralevent', input.eventId))) throw new Error('REFERRAL_INBOX_CONFLICT');
    });
  }

  private async paid(context: WriteTransactionContext, transaction: SqlExecutor, input: ReferralProcessEvent, payload: Readonly<Record<string, unknown>>, occurredAt: string): Promise<void> {
    const snapshot = object(payload.snapshot, 'REFERRAL_ORDER_SNAPSHOT_REQUIRED');
    if (text(snapshot.order, 'REFERRAL_ORDER_REFERENCE_REQUIRED') !== input.resourceId) throw new Error('REFERRAL_ORDER_SNAPSHOT_MISMATCH');
    const memberId = text(snapshot.member, 'REFERRAL_MEMBER_REFERENCE_REQUIRED');
    const currency = text(snapshot.currency, 'REFERRAL_CURRENCY_REQUIRED');
    if (text(payload.member, 'REFERRAL_MEMBER_REFERENCE_REQUIRED') !== memberId || text(payload.currency, 'REFERRAL_CURRENCY_REQUIRED') !== currency) throw new Error('REFERRAL_ORDER_SNAPSHOT_MISMATCH');
    const setting = (await transaction.query<ReferralSettingRow>(`select enabled,reward_enabled,settlement_trigger,rate_basis_points,currency,version,freeze_days from referral.setting where scope_id=$1 for share`, [input.scopeId])).rows[0];
    if (!setting?.enabled) return;
    if (setting.currency !== currency) throw new Error('REFERRAL_CURRENCY_MISMATCH');
    const binding = (
      await transaction.query<ReferralBindingRow>(
        `select binding.id,member.member_id beneficiary_id,
        (select inviter.member_id from referral.binding parentbinding
          join referral.member inviter on inviter.id=parentbinding.promoter_id and inviter.scope_id=parentbinding.scope_id and inviter.state='active'
          where parentbinding.scope_id=binding.scope_id and parentbinding.customer_id=member.member_id
            and parentbinding.bound_at<=$3::timestamptz and (parentbinding.expires_at is null or parentbinding.expires_at>$3::timestamptz)
          order by parentbinding.bound_at desc,parentbinding.id desc limit 1) inviter_beneficiary_id
        from referral.binding binding
        join referral.member member on member.id=binding.promoter_id and member.scope_id=binding.scope_id and member.state='active'
        where binding.scope_id=$1 and binding.customer_id=$2 and binding.bound_at<=$3::timestamptz and (binding.expires_at is null or binding.expires_at>$3::timestamptz)
        order by binding.bound_at desc,binding.id desc limit 1 for share of binding,member`,
        [input.scopeId, memberId, occurredAt]
      )
    ).rows[0];
    if (!binding || binding.beneficiary_id === memberId) return;
    const lines = array(snapshot.lines, 'REFERRAL_ORDER_LINES_REQUIRED').map(orderLine);
    const totalMinor = integer(snapshot.totalMinor, 'REFERRAL_ORDER_AMOUNT_INVALID');
    if (lines.reduce((sum, line) => sum + line.payableMinor, 0) !== totalMinor) throw new Error('REFERRAL_ORDER_EVIDENCE_MISMATCH');
    const benefitMinor = benefitAmount(snapshot.tenders, totalMinor);
    const bases = this.commissions.bases(
      lines.map(({ lineId, payableMinor }) => ({ id: lineId, amountMinor: BigInt(payableMinor) })),
      benefitMinor
    );
    const productIds = [...new Set(lines.map(({ productId }) => productId))];
    const products = await transaction.query<ReferralProductRow>(
      `select id,product_id,enabled,rate_basis_points,reward_basis_points,version from referral.product
      where scope_id=$1 and product_id=any($2::text[]) for share`,
      [input.scopeId, productIds]
    );
    const configured = new Map(products.rows.map((product) => [product.product_id, product]));
    for (const line of lines) {
      const product = configured.get(line.productId);
      if (!product?.enabled) continue;
      const baseMinor = bases.get(line.lineId) ?? 0n;
      const commissionRate = product.rate_basis_points > 0 ? product.rate_basis_points : setting.rate_basis_points;
      const recipients = this.commissions.recipients({
        customerId: memberId,
        directMemberId: binding.beneficiary_id,
        inviterMemberId: binding.inviter_beneficiary_id,
        rewardEnabled: setting.reward_enabled,
        commissionBasisPoints: commissionRate,
        rewardBasisPoints: product.reward_basis_points,
      });
      for (const recipient of recipients) {
        const amountMinor = new ReferralRate(recipient.rateBasisPoints).apply(baseMinor);
        if (amountMinor === 0n) continue;
        const businessKey = `commission:${input.scopeId}:${input.resourceId}:${line.lineId}:${product.id}:${product.version}:${recipient.kind}:${recipient.beneficiaryId}`;
        const id = deterministic('referralcommission', businessKey);
        const commission = new Commission(
          id,
          businessKey,
          input.scopeId,
          input.resourceId,
          line.lineId,
          product.id,
          product.version,
          binding.id,
          recipient.beneficiaryId,
          recipient.kind,
          baseMinor,
          0n,
          recipient.rateBasisPoints,
          amountMinor,
          currency,
          'pending',
          0n,
          1
        );
        const snapshot = {
          productId: line.productId,
          kind: commission.kind,
          rateBasisPoints: commission.rateBasisPoints,
          commissionBasisPoints: commissionRate,
          rewardBasisPoints: product.reward_basis_points,
          rewardEnabled: setting.reward_enabled,
          settlementTrigger: setting.settlement_trigger,
          freezeDays: setting.freeze_days,
          productVersion: commission.ruleVersion,
          settingVersion: setting.version,
        };
        const inserted = await transaction.query<{ id: string; version: number }>(
          `insert into referral.commission(id,business_key,scope_id,order_id,order_line_id,product_id,beneficiary_id,kind,
            binding_id,rule_id,rule_version,rule_snapshot,setting_version,base_minor,refunded_base_minor,amount_minor,
            rate_basis_points,currency,reversed_minor,state,origin_event_id,origin_event_version,eligible_at,version,created_at,updated_at)
          values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,0,$15,$16,$17,0,'pending',$18,$19,null,1,$20::timestamptz,$20::timestamptz)
          on conflict(business_key) do nothing returning id,version`,
          [
            commission.id,
            commission.businessKey,
            commission.scopeId,
            commission.orderId,
            line.lineId,
            line.productId,
            commission.beneficiaryId,
            commission.kind,
            commission.attributionId,
            commission.ruleId,
            commission.ruleVersion,
            JSON.stringify(snapshot),
            setting.version,
            safeNumber(commission.baseMinor),
            safeNumber(commission.money.amountMinor),
            commission.rateBasisPoints,
            commission.money.currency,
            input.eventId,
            1,
            occurredAt,
          ]
        );
        if (!inserted.rows[0]) continue;
        await this.outbox.append(
          context,
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
    if (setting.settlement_trigger === 'paid') {
      const releaseAt = this.settlement.releaseAt(occurredAt, setting.freeze_days);
      const changed = await transaction.query(
        `update referral.commission set state='available',eligible_at=$3::timestamptz,version=version+1,updated_at=clock_timestamp()
        where scope_id=$1 and order_id=$2 and state='pending' and rule_snapshot->>'settlementTrigger'='paid' returning id`,
        [input.scopeId, input.resourceId, releaseAt]
      );
      if ((changed.rowCount ?? 0) > 0) await enqueueSettlement(transaction, input.scopeId, input.resourceId, releaseAt);
    }
  }

  private async received(transaction: SqlExecutor, input: ReferralProcessEvent, payload: Readonly<Record<string, unknown>>, occurredAt: string): Promise<void> {
    if (text(payload.orderId, 'REFERRAL_ORDER_REFERENCE_REQUIRED') !== input.resourceId) throw new Error('REFERRAL_ORDER_EVENT_MISMATCH');
    if (text(payload.fulfillmentState, 'REFERRAL_FULFILLMENT_STATE_REQUIRED') !== 'received') throw new Error('REFERRAL_RECEIPT_EVIDENCE_INVALID');
    const changed = await transaction.query<{ eligible_at: Date | string }>(
      `update referral.commission set state='available',
      eligible_at=$3::timestamptz+make_interval(days=>(rule_snapshot->>'freezeDays')::integer),version=version+1,updated_at=clock_timestamp()
      where scope_id=$1 and order_id=$2 and state='pending' and reversed_minor<amount_minor
        and rule_snapshot->>'settlementTrigger'='received' returning eligible_at`,
      [input.scopeId, input.resourceId, occurredAt]
    );
    const releaseAt = changed.rows.map(({ eligible_at }) => new Date(eligible_at).toISOString()).sort()[0];
    if (releaseAt) await enqueueSettlement(transaction, input.scopeId, input.resourceId, releaseAt);
  }

  private async approved(context: WriteTransactionContext, transaction: SqlExecutor, input: ReferralProcessEvent, payload: Readonly<Record<string, unknown>>, occurredAt: string): Promise<void> {
    if (payload.subjectKind !== 'withdrawal' || text(payload.subjectId, 'REFERRAL_APPROVAL_SUBJECT_INVALID') !== input.resourceId || payload.action !== 'referral.withdrawal.pay') throw new Error('REFERRAL_APPROVAL_SUBJECT_INVALID');
    const instance = await this.approvals.read(context, input.scopeId, input.sourceId);
    if (!instance || instance.state !== 'approved' || instance.subjectId !== input.resourceId || instance.subjectVersion !== payload.subjectVersion || instance.action !== 'referral.withdrawal.pay')
      throw new Error('REFERRAL_APPROVAL_EVIDENCE_INVALID');
    const checker = [...instance.decisions].reverse().find(({ outcome }) => outcome === 'approved')?.actorId ?? '';
    this.withdrawals.assertApproval({ requesterId: instance.requesterId, checkerId: checker, subjectId: instance.subjectId, withdrawalId: input.resourceId, action: instance.action });
    const changed = await transaction.query(
      `update referral.withdrawalclaim set state='processing',approval_proof_id=$3,approved_at=$4::timestamptz,version=version+1
      where id=$1 and scope_id=$2 and state='requested' and approval_instance_id=$5 and version=$6`,
      [input.resourceId, input.scopeId, text(payload.proofId, 'REFERRAL_APPROVAL_PROOF_REQUIRED'), occurredAt, input.sourceId, instance.subjectVersion]
    );
    if (changed.rowCount === 0) throw new Error('REFERRAL_WITHDRAWAL_APPROVAL_CONFLICT');
    await enqueueSettlement(transaction, input.scopeId, input.resourceId, occurredAt);
  }
}
