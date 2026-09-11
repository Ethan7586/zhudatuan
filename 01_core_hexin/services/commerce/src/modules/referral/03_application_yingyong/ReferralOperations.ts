import { randomUUID } from 'node:crypto';
import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../foundation/application/AuditSink';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';
import { ModuleOperations, requireAccess, rowResult, type OperationActions, type OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { bodyRecord, integerField, keysetResult, optionalText, queryPage, textField } from '../../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../../foundation/persistence/Pool';
import { memberPort } from '../../member';

const MEMBER_STATES = ['pending', 'active', 'disqualified'] as const;
const COMMISSION_STATES = ['pending', 'settling', 'settled', 'reversed'] as const;
const HELD_CLAIM_STATES = "'reserved','submitted','approved','processing','paid','failed','uncertain'";

export function referralOperations(context: ModuleContext): ModuleOperations {
  const pool = context.container.get(DATABASE_POOL);
  return new ModuleOperations('referral', pool, context.container.get(AUDIT_SINK), referralOperationActions());
}

export function referralOperationActions(): OperationActions {
  return {
    'referral.settings.read': async (request, database) => {
      const scope = mallScope(request);
      const result = await database.query(
        `select id,scope_id,enabled,recruit_enabled,review_required,reward_enabled,binding_mode,binding_days,
          settle_trigger,settle_delay_days,withdraw_min_minor::text withdraw_min_minor,
          withdraw_monthly_max,created_at,updated_at,version
        from referral.setting where scope_id=$1`,
        [scope]
      );
      if (result.rows[0]) return rowResult(result);
      return {
        status: 200,
        headers: { etag: '"0"' },
        body: {
          id: settingId(scope),
          scope_id: scope,
          enabled: false,
          recruit_enabled: false,
          review_required: true,
          reward_enabled: false,
          binding_mode: 'permanent',
          binding_days: null,
          settle_trigger: 'on_paid',
          settle_delay_days: 0,
          withdraw_min_minor: '0',
          withdraw_monthly_max: null,
          version: 0,
          persisted: false,
        },
      };
    },

    'referral.settings.manage': async (request, database) => {
      const scope = mallScope(request);
      const body = bodyRecord(request);
      const expected = expectedVersion(request);
      const bindingMode = choice(body.bindingMode, ['permanent', 'days'] as const, 'REFERRAL_BINDING_MODE_INVALID');
      const bindingDays = bindingMode === 'days' ? integerField(body, 'bindingDays', 1) : null;
      if (bindingDays !== null && bindingDays > 3650) throw new Error('REFERRAL_BINDING_DAYS_INVALID');
      const settleTrigger = choice(body.settleTrigger, ['on_paid', 'on_received'] as const, 'REFERRAL_SETTLE_TRIGGER_INVALID');
      const settleDelayDays = integerField(body, 'settleDelayDays');
      if (settleDelayDays > 3650) throw new Error('REFERRAL_SETTLE_DELAY_INVALID');
      const minimum = integerField(body, 'withdrawMinMinor');
      const monthlyMaximum = optionalInteger(body.withdrawMonthlyMax, 'withdrawMonthlyMax', 1);
      const result = await database.query(
        `insert into referral.setting(id,scope_id,enabled,recruit_enabled,review_required,reward_enabled,binding_mode,binding_days,
          settle_trigger,settle_delay_days,withdraw_min_minor,withdraw_monthly_max,created_at,updated_at,version)
        select $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,clock_timestamp(),clock_timestamp(),0 where $13::bigint=0
        on conflict(scope_id) do update set enabled=excluded.enabled,recruit_enabled=excluded.recruit_enabled,
          review_required=excluded.review_required,reward_enabled=excluded.reward_enabled,binding_mode=excluded.binding_mode,
          binding_days=excluded.binding_days,settle_trigger=excluded.settle_trigger,settle_delay_days=excluded.settle_delay_days,
          withdraw_min_minor=excluded.withdraw_min_minor,withdraw_monthly_max=excluded.withdraw_monthly_max,
          updated_at=clock_timestamp(),version=referral.setting.version+1
        where referral.setting.version=$13
        returning id,scope_id,enabled,recruit_enabled,review_required,reward_enabled,binding_mode,binding_days,
          settle_trigger,settle_delay_days,withdraw_min_minor::text withdraw_min_minor,
          withdraw_monthly_max,created_at,updated_at,version`,
        [
          settingId(scope),
          scope,
          booleanField(body, 'enabled'),
          booleanField(body, 'recruitEnabled'),
          booleanField(body, 'reviewRequired'),
          booleanField(body, 'rewardEnabled'),
          bindingMode,
          bindingDays,
          settleTrigger,
          settleDelayDays,
          minimum,
          monthlyMaximum,
          expected,
        ]
      );
      if (!result.rows[0]) throw new Error('VERSION_CONFLICT');
      return rowResult(result, expected === 0 ? 201 : 200);
    },

    'referral.products.read': async (request, database) => {
      const scope = mallScope(request);
      const page = queryPage(request, 200);
      const result = await database.query(
        `select referral_product.id,referral_product.scope_id,referral_product.sku_id,sku.code,product.id product_id,
          listing.id listing_id,listing.title,listing.status listing_status,referral_product.commission_bps,
          referral_product.reward_bps,referral_product.enabled,referral_product.created_at,
          referral_product.updated_at,referral_product.version
        from referral.product referral_product
        join catalog.listing listing on listing.scope_id=referral_product.scope_id and listing.sku_id=referral_product.sku_id
        join catalog.sku sku on sku.id=referral_product.sku_id
        join catalog.product product on product.id=sku.product_id
        where referral_product.scope_id=$1
          and ($2::timestamptz is null or (referral_product.updated_at,referral_product.id)<($2::timestamptz,$3))
        order by referral_product.updated_at desc,referral_product.id desc limit $4`,
        [scope, page.sort, page.id, page.fetch]
      );
      return keysetResult(result, page, 'updated_at');
    },

    'referral.products.manage': async (request, database) => {
      const scope = mallScope(request);
      const body = bodyRecord(request);
      const sku = textField(body, 'sku');
      const commissionBps = integerField(body, 'commissionBps');
      const rewardBps = integerField(body, 'rewardBps');
      if (commissionBps > 10_000 || rewardBps > 10_000 || commissionBps + rewardBps > 10_000) {
        throw new Error('REFERRAL_RATE_INVALID');
      }
      const listing = await database.query('select 1 from catalog.listing where scope_id=$1 and sku_id=$2', [scope, sku]);
      if (!listing.rows[0]) throw new Error('REFERRAL_SKU_NOT_LISTED');
      const expected = expectedVersion(request);
      const result = await database.query(
        `insert into referral.product(id,scope_id,sku_id,commission_bps,reward_bps,enabled,created_at,updated_at,version)
        select $1,$2,$3,$4,$5,$6,clock_timestamp(),clock_timestamp(),0 where $7::bigint=0
        on conflict(scope_id,sku_id) do update set commission_bps=excluded.commission_bps,reward_bps=excluded.reward_bps,
          enabled=excluded.enabled,updated_at=clock_timestamp(),version=referral.product.version+1
        where referral.product.version=$7
        returning id,scope_id,sku_id,commission_bps,reward_bps,enabled,created_at,updated_at,version`,
        [productId(scope, sku), scope, sku, commissionBps, rewardBps, booleanField(body, 'enabled'), expected]
      );
      if (!result.rows[0]) throw new Error('VERSION_CONFLICT');
      return rowResult(result, expected === 0 ? 201 : 200);
    },

    'referral.members.read': async (request, database) => {
      const scope = mallScope(request);
      const page = queryPage(request, 200);
      const state = queryChoice(request, 'state', MEMBER_STATES);
      const result = await database.query(
        `select referral_member.id,referral_member.scope_id,referral_member.member_id,profile.display_name,
          referral_member.inviter_member_id,inviter.member_id inviter_profile_id,inviter_profile.display_name inviter_display_name,
          referral_member.state,referral_member.approved_by,referral_member.approved_at,referral_member.created_at,
          referral_member.updated_at,referral_member.version
        from referral.member referral_member
        join member.profile profile on profile.id=referral_member.member_id
        left join referral.member inviter on inviter.scope_id=referral_member.scope_id and inviter.id=referral_member.inviter_member_id
        left join member.profile inviter_profile on inviter_profile.id=inviter.member_id
        where referral_member.scope_id=$1 and ($2::text is null or referral_member.state=$2)
          and ($3::timestamptz is null or (referral_member.updated_at,referral_member.id)<($3::timestamptz,$4))
        order by referral_member.updated_at desc,referral_member.id desc limit $5`,
        [scope, state, page.sort, page.id, page.fetch]
      );
      return keysetResult(result, page, 'updated_at');
    },

    'referral.members.apply': async (request, database) => {
      const self = await resolveSelf(request, database);
      const body = bodyRecord(request);
      const existing = await findReferralMember(database, self.scope, self.member);
      if (existing) {
        if (existing.state === 'disqualified') throw new Error('REFERRAL_MEMBER_DISQUALIFIED');
        return { ...rowResultFromRow(existing), status: 200 };
      }
      const setting = (await database.query<{ review_required: boolean }>(`select review_required from referral.setting where scope_id=$1 and enabled and recruit_enabled for share`, [self.scope])).rows[0];
      if (!setting) throw new Error('REFERRAL_RECRUITMENT_NOT_AVAILABLE');
      const inviter = optionalText(body, 'inviter');
      if (inviter !== null) {
        const eligible = await database.query(`select 1 from referral.member where scope_id=$1 and id=$2 and state='active' and member_id<>$3`, [self.scope, inviter, self.member]);
        if (!eligible.rows[0]) throw new Error('REFERRAL_INVITER_INVALID');
      }
      const state = setting.review_required ? 'pending' : 'active';
      const id = `referral-member:${randomUUID()}`;
      const result = await database.query(
        `insert into referral.member(id,scope_id,member_id,inviter_member_id,state,approved_by,approved_at,
          created_at,updated_at,version)
        values($1,$2,$3,$4,$5,case when $5='active' then 'system:referral' end,
          case when $5='active' then clock_timestamp() end,clock_timestamp(),clock_timestamp(),0)
        on conflict(scope_id,member_id) do nothing returning *`,
        [id, self.scope, self.member, inviter, state]
      );
      if (result.rows[0]) return rowResult(result, 201);
      const winner = await findReferralMember(database, self.scope, self.member);
      if (!winner || winner.state === 'disqualified') throw new Error('REFERRAL_MEMBER_APPLICATION_CONFLICT');
      return { ...rowResultFromRow(winner), status: 200 };
    },

    'referral.members.approve': async (request, database) => {
      const access = requireAccess(request);
      const scope = mallScope(request);
      const body = bodyRecord(request);
      const result = await database.query(
        `update referral.member set state='active',approved_by=$3,approved_at=clock_timestamp(),
          updated_at=clock_timestamp(),version=version+1
        where id=$1 and scope_id=$2 and state='pending' and version=$4 returning *`,
        [textField(body, 'member'), scope, access.actor.id, expectedVersion(request)]
      );
      if (!result.rows[0]) throw new Error('REFERRAL_MEMBER_STATE_CONFLICT');
      return rowResult(result);
    },

    'referral.members.disqualify': async (request, database) => {
      const access = requireAccess(request);
      const scope = mallScope(request);
      const body = bodyRecord(request);
      const result = await database.query(
        `update referral.member set state='disqualified',approved_by=coalesce(approved_by,$3),
          approved_at=coalesce(approved_at,clock_timestamp()),updated_at=clock_timestamp(),version=version+1
        where id=$1 and scope_id=$2 and state in('pending','active') and version=$4 returning *`,
        [textField(body, 'member'), scope, access.actor.id, expectedVersion(request)]
      );
      if (!result.rows[0]) throw new Error('REFERRAL_MEMBER_STATE_CONFLICT');
      return rowResult(result);
    },

    'referral.bindings.read': async (request, database) => {
      const scope = mallScope(request);
      const page = queryPage(request, 200);
      const result = await database.query(
        `select binding.id,binding.scope_id,binding.customer_member_id,customer.display_name customer_display_name,
          binding.referral_member_id,referral_member.member_id referral_profile_id,
          referral_profile.display_name referral_display_name,binding.bound_at,binding.expires_at,
          binding.created_at,binding.updated_at,binding.version
        from referral.binding binding
        join member.profile customer on customer.id=binding.customer_member_id
        join referral.member referral_member on referral_member.scope_id=binding.scope_id and referral_member.id=binding.referral_member_id
        join member.profile referral_profile on referral_profile.id=referral_member.member_id
        where binding.scope_id=$1 and ($2::timestamptz is null or (binding.bound_at,binding.id)<($2::timestamptz,$3))
        order by binding.bound_at desc,binding.id desc limit $4`,
        [scope, page.sort, page.id, page.fetch]
      );
      return keysetResult(result, page, 'bound_at');
    },

    'referral.bindings.create': async (request, database) => {
      const self = await resolveSelf(request, database);
      const candidate = textField(bodyRecord(request), 'referralMember');
      const result = await database.query<BindingWinner>(
        `select binding_id,winner_referral_member_id,created,winner_bound_at bound_at,winner_expires_at expires_at
        from referral.bind_first_touch($1,$2,$3,$4,clock_timestamp())`,
        [`referral-binding:${randomUUID()}`, self.scope, self.member, candidate]
      );
      const winner = result.rows[0];
      if (!winner) throw new Error('REFERRAL_BINDING_FAILED');
      if (winner.created) {
        const access = requireAccess(request);
        await memberPort.bindStorefrontParent(database, {
          scope: self.scope,
          member: self.member,
          referralMember: winner.winner_referral_member_id,
          requestedBy: access.actor.id,
          traceId: request.input.idempotency!,
          effectiveAt: new Date(winner.bound_at),
        });
      }
      return {
        status: winner.created ? 201 : 200,
        body: { ...winner, candidate_won: winner.winner_referral_member_id === candidate },
      };
    },

    'referral.commissions.read': async (request, database) => {
      const scope = mallScope(request);
      const page = queryPage(request, 200);
      const state = queryChoice(request, 'state', COMMISSION_STATES);
      const order = queryText(request, 'order', 255);
      const beneficiary = queryText(request, 'member', 255);
      const result = await database.query(
        `select commission.id,commission.scope_id,commission.order_id,commission.order_line_id,commission.sku_id,
          commission.beneficiary_member_id,profile.display_name beneficiary_display_name,commission.kind,commission.currency,
          commission.base_minor::text base_minor,commission.rate_bps,commission.amount_minor::text amount_minor,
          commission.reversed_base_minor::text reversed_base_minor,commission.reversed_minor::text reversed_minor,
          coalesce((select sum(claim.amount_minor) from referral.withdrawalclaim claim
            where claim.scope_id=commission.scope_id and claim.commission_id=commission.id
              and claim.state in(${HELD_CLAIM_STATES})),0)::text claimed_minor,
          coalesce((select sum(case movement.kind when 'accrual' then movement.amount_minor else -movement.amount_minor end)
            from referral.recoverymovement movement where movement.scope_id=commission.scope_id
              and movement.source_commission_id=commission.id),0)::text recovery_minor,
          case when commission.state='settled' then greatest(0,commission.amount_minor-commission.reversed_minor-
            coalesce((select sum(claim.amount_minor) from referral.withdrawalclaim claim
              where claim.scope_id=commission.scope_id and claim.commission_id=commission.id
                and claim.state in(${HELD_CLAIM_STATES})),0)-
            coalesce((select sum(movement.amount_minor) from referral.recoverymovement movement
              where movement.scope_id=commission.scope_id and movement.kind='offset'
                and movement.settlement_commission_id=commission.id),0)) else 0 end::text withdrawable_minor,
          commission.state,commission.origin_event_id,commission.setting_version,commission.product_version,
          commission.settle_trigger,commission.settle_delay_days,commission.eligible_at,commission.journal_id,
          commission.reversal_journal_id,commission.reversal_event_id,commission.settling_at,commission.settled_at,
          commission.reversed_at,commission.created_at,commission.updated_at,commission.version
        from referral.commission commission join member.profile profile on profile.id=commission.beneficiary_member_id
        where commission.scope_id=$1 and ($2::text is null or commission.state=$2)
          and ($3::text is null or commission.order_id=$3) and ($4::text is null or commission.beneficiary_member_id=$4)
          and ($5::timestamptz is null or (commission.created_at,commission.id)<($5::timestamptz,$6))
        order by commission.created_at desc,commission.id desc limit $7`,
        [scope, state, order, beneficiary, page.sort, page.id, page.fetch]
      );
      return keysetResult(result, page, 'created_at');
    },

    'referral.earnings.read': async (request, database) => {
      const self = await resolveSelf(request, database);
      const page = queryPage(request, 200);
      const summary = await database.query(
        `with amounts as(
          select commission.state,commission.amount_minor-commission.reversed_minor remaining_minor,
            greatest(0,commission.amount_minor-commission.reversed_minor-coalesce((select sum(claim.amount_minor)
              from referral.withdrawalclaim claim where claim.scope_id=commission.scope_id
                and claim.commission_id=commission.id and claim.state in(${HELD_CLAIM_STATES})),0)-
              coalesce((select sum(movement.amount_minor) from referral.recoverymovement movement
                where movement.scope_id=commission.scope_id and movement.kind='offset'
                  and movement.settlement_commission_id=commission.id),0)) withdrawable_minor,
            coalesce((select sum(case movement.kind when 'accrual' then movement.amount_minor else -movement.amount_minor end)
              from referral.recoverymovement movement where movement.scope_id=commission.scope_id
                and movement.source_commission_id=commission.id),0) recovery_minor
          from referral.commission commission where commission.scope_id=$1 and commission.beneficiary_member_id=$2
        ) select coalesce(sum(remaining_minor) filter(where state='pending'),0)::text pending_minor,
          coalesce(sum(remaining_minor) filter(where state='settling'),0)::text settling_minor,
          coalesce(sum(remaining_minor) filter(where state='settled'),0)::text settled_minor,
          case when coalesce(sum(recovery_minor),0)>0 then 0
            else coalesce(sum(withdrawable_minor) filter(where state='settled'),0) end::text withdrawable_minor,
          coalesce(sum(recovery_minor),0)::text recovery_minor
        from amounts`,
        [self.scope, self.member]
      );
      const items = await database.query(
        `select commission.id,commission.order_id,commission.order_line_id,commission.sku_id,commission.kind,
          commission.currency,commission.base_minor::text base_minor,commission.rate_bps,
          commission.amount_minor::text amount_minor,commission.reversed_minor::text reversed_minor,commission.state,
          coalesce((select sum(claim.amount_minor) from referral.withdrawalclaim claim
            where claim.scope_id=commission.scope_id and claim.commission_id=commission.id
              and claim.state in(${HELD_CLAIM_STATES})),0)::text claimed_minor,
          coalesce((select sum(case movement.kind when 'accrual' then movement.amount_minor else -movement.amount_minor end)
            from referral.recoverymovement movement where movement.scope_id=commission.scope_id
              and movement.source_commission_id=commission.id),0)::text recovery_minor,
          case when commission.state='settled' then greatest(0,commission.amount_minor-commission.reversed_minor-
            coalesce((select sum(claim.amount_minor) from referral.withdrawalclaim claim
              where claim.scope_id=commission.scope_id and claim.commission_id=commission.id
                and claim.state in(${HELD_CLAIM_STATES})),0)-
            coalesce((select sum(movement.amount_minor) from referral.recoverymovement movement
              where movement.scope_id=commission.scope_id and movement.kind='offset'
                and movement.settlement_commission_id=commission.id),0)) else 0 end::text withdrawable_minor,
          commission.eligible_at,commission.settled_at,commission.created_at,commission.version
        from referral.commission commission where commission.scope_id=$1 and commission.beneficiary_member_id=$2
          and ($3::timestamptz is null or (commission.created_at,commission.id)<($3::timestamptz,$4))
        order by commission.created_at desc,commission.id desc limit $5`,
        [self.scope, self.member, page.sort, page.id, page.fetch]
      );
      const pageResult = keysetResult(items, page, 'created_at');
      return {
        ...pageResult,
        body: { summary: summary.rows[0], ...(pageResult.body as Readonly<Record<string, unknown>>) },
      };
    },

    'referral.links.read': async (request, database) => {
      const self = await resolveSelf(request, database);
      const page = queryPage(request, 200);
      const result = await database.query(
        `select referral_product.id,referral_member.id referral_member_id,referral_product.sku_id,sku.product_id,listing.title,
          referral_product.commission_bps,referral_product.reward_bps,referral_product.updated_at
        from referral.member referral_member
        join referral.setting setting on setting.scope_id=referral_member.scope_id and setting.enabled
        join referral.product referral_product on referral_product.scope_id=referral_member.scope_id and referral_product.enabled
        join catalog.listing listing on listing.scope_id=referral_product.scope_id and listing.sku_id=referral_product.sku_id
          and listing.status='published' and (listing.effective_at is null or listing.effective_at<=clock_timestamp())
          and (listing.expires_at is null or listing.expires_at>clock_timestamp())
        join catalog.sku sku on sku.id=referral_product.sku_id
        where referral_member.scope_id=$1 and referral_member.member_id=$2 and referral_member.state='active'
          and ($3::timestamptz is null or (referral_product.updated_at,referral_product.id)<($3::timestamptz,$4))
        order by referral_product.updated_at desc,referral_product.id desc limit $5`,
        [self.scope, self.member, page.sort, page.id, page.fetch]
      );
      const response = keysetResult(result, page, 'updated_at');
      const body = response.body as { items: readonly Record<string, unknown>[] } & Readonly<Record<string, unknown>>;
      return {
        ...response,
        body: {
          ...body,
          items: body.items.map((item) => ({
            ...item,
            share_path: `/?referral=${encodeURIComponent(String(item.referral_member_id))}&sku=${encodeURIComponent(String(item.sku_id))}`,
          })),
        },
      };
    },

    'referral.withdrawals.read': async (request, database) => {
      const self = await resolveSelf(request, database);
      const page = queryPage(request, 200);
      const result = await database.query(
        `select withdrawal.id,withdrawal.scope_id,withdrawal.source_id referral_member_id,
          withdrawal.beneficiary_member_id,withdrawal.amount_minor::text amount_minor,withdrawal.currency,
          withdrawal.destination_ref,withdrawal.state,withdrawal.requested_by,withdrawal.approved_by,withdrawal.reason,
          withdrawal.provider_reference,withdrawal.created_at,withdrawal.updated_at,withdrawal.paid_at,withdrawal.version,
          coalesce((select count(*) from referral.withdrawalclaim claim where claim.scope_id=withdrawal.scope_id
            and claim.withdrawal_id=withdrawal.id),0)::integer claim_count
        from finance.withdrawal withdrawal join referral.member referral_member
          on referral_member.scope_id=withdrawal.scope_id and referral_member.id=withdrawal.source_id
        where withdrawal.scope_id=$1 and withdrawal.source_kind='referral' and referral_member.member_id=$2
          and withdrawal.beneficiary_member_id=$2
          and ($3::timestamptz is null or (withdrawal.created_at,withdrawal.id)<($3::timestamptz,$4))
        order by withdrawal.created_at desc,withdrawal.id desc limit $5`,
        [self.scope, self.member, page.sort, page.id, page.fetch]
      );
      return keysetResult(result, page, 'created_at');
    },

    'referral.withdrawals.create': async (request, database) => {
      const self = await resolveSelf(request, database);
      return createReferralWithdrawal(request, database, self);
    },
  };
}

async function createReferralWithdrawal(request: OperationRequest, database: OperationDatabase, self: SelfIdentity) {
  const access = requireAccess(request);
  const body = bodyRecord(request);
  const amount = integerField(body, 'amountMinor', 1);
  const currency = (optionalText(body, 'currency', 3) ?? 'CNY').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('REFERRAL_WITHDRAW_CURRENCY_INVALID');
  const owner = (
    await database.query<WithdrawalOwner>(
      `select referral_member.id,referral_member.member_id,setting.withdraw_min_minor::text withdraw_min_minor,
        setting.withdraw_monthly_max
      from referral.member referral_member join referral.setting setting on setting.scope_id=referral_member.scope_id
      where referral_member.scope_id=$1 and referral_member.member_id=$2
        and referral_member.state in('active','disqualified') for update of referral_member`,
      [self.scope, self.member]
    )
  ).rows[0];
  if (!owner) throw new Error('REFERRAL_WITHDRAW_MEMBER_NOT_FOUND');
  const requested = BigInt(amount);
  if (requested < minor(owner.withdraw_min_minor, 'REFERRAL_WITHDRAW_POLICY_INVALID')) {
    throw new Error('REFERRAL_WITHDRAW_BELOW_MINIMUM');
  }
  const reversalPending = (await database.query<{ blocked: boolean }>(`select referral.has_pending_reversal($1,$2) blocked`, [self.scope, self.member])).rows[0]?.blocked;
  if (reversalPending) throw new Error('REFERRAL_WITHDRAW_REVERSAL_PENDING');
  const monthlyUsed = (
    await database.query<{ withdrawal_count: number }>(
      `select count(*)::integer withdrawal_count from finance.withdrawal
      where scope_id=$1 and source_kind='referral' and source_id=$2 and currency=$3
        and state not in('rejected','cancelled') and created_at>=date_trunc('month',clock_timestamp())`,
      [self.scope, owner.id, currency]
    )
  ).rows[0]?.withdrawal_count;
  const monthlyMaximum = owner.withdraw_monthly_max;
  if (monthlyMaximum !== null && (monthlyUsed ?? 0) + 1 > monthlyMaximum) {
    throw new Error('REFERRAL_WITHDRAW_MONTHLY_MAX_EXCEEDED');
  }
  const recovery = (
    await database.query<{ recovery_minor: string }>(
      `select coalesce(sum(case movement.kind when 'accrual' then movement.amount_minor else -movement.amount_minor end),0)::text recovery_minor
      from referral.recoverymovement movement where movement.scope_id=$1
        and movement.beneficiary_member_id=$2 and movement.currency=$3`,
      [self.scope, self.member, currency]
    )
  ).rows[0]?.recovery_minor;
  if (minor(recovery ?? '0', 'REFERRAL_RECOVERY_AMOUNT_INVALID') > 0n) {
    throw new Error('REFERRAL_WITHDRAW_OUTSTANDING_RECOVERY');
  }

  const candidates = await database.query<WithdrawableCommission>(
    `select commission.id,commission.currency,
      (commission.amount_minor-commission.reversed_minor-coalesce((select sum(claim.amount_minor)
        from referral.withdrawalclaim claim where claim.scope_id=commission.scope_id
          and claim.commission_id=commission.id and claim.state in(${HELD_CLAIM_STATES})),0)-
        coalesce((select sum(movement.amount_minor) from referral.recoverymovement movement
          where movement.scope_id=commission.scope_id and movement.kind='offset'
            and movement.settlement_commission_id=commission.id),0))::text available_minor
    from referral.commission commission where commission.scope_id=$1 and commission.beneficiary_member_id=$2
      and commission.currency=$3 and commission.state='settled'
      and commission.amount_minor-commission.reversed_minor>coalesce((select sum(claim.amount_minor)
        from referral.withdrawalclaim claim where claim.scope_id=commission.scope_id
          and claim.commission_id=commission.id and claim.state in(${HELD_CLAIM_STATES})),0)
        +coalesce((select sum(movement.amount_minor) from referral.recoverymovement movement
          where movement.scope_id=commission.scope_id and movement.kind='offset'
            and movement.settlement_commission_id=commission.id),0)
    order by commission.settled_at,commission.id`,
    [self.scope, self.member, currency]
  );
  const allocations = allocateWithdrawal(candidates.rows, requested);
  const claimIds = allocations.map(() => `referral-claim:${randomUUID()}`);
  const commissionIds = allocations.map((allocation) => allocation.commission);
  const amounts = allocations.map((allocation) => allocation.amount.toString());
  const reserved = await database.query(
    `insert into referral.withdrawalclaim(id,scope_id,beneficiary_member_id,commission_id,withdrawal_id,
      amount_minor,state,requested_at,updated_at,version)
    select allocation.claim_id,$4,$5,allocation.commission_id,null,allocation.amount_minor,'reserved',
      clock_timestamp(),clock_timestamp(),0
    from unnest($1::text[],$2::text[],$3::bigint[]) allocation(claim_id,commission_id,amount_minor)
    returning id`,
    [claimIds, commissionIds, amounts, self.scope, self.member]
  );
  if (reserved.rowCount !== allocations.length) throw new Error('REFERRAL_WITHDRAW_RESERVATION_CONFLICT');

  const withdrawalId = `withdrawal:${randomUUID()}`;
  const evidence = {
    ...record(body.evidence),
    source: 'referral',
    referralMember: owner.id,
    trace: access.trace,
  };
  const withdrawal = await database.query(
    `insert into finance.withdrawal(id,scope_id,settlement_id,source_kind,source_id,beneficiary_member_id,
      amount_minor,currency,destination_ref,state,requested_by,reason,evidence,created_at,updated_at,version)
    values($1,$2,null,'referral',$3,$4,$5,$6,$7,'submitted',$8,$9,$10::jsonb,clock_timestamp(),clock_timestamp(),0)
    returning *`,
    [withdrawalId, self.scope, owner.id, self.member, amount, currency, textField(body, 'destinationRef', 500), access.actor.id, textField(body, 'reason', 1000), JSON.stringify(evidence)]
  );
  if (!withdrawal.rows[0]) throw new Error('REFERRAL_WITHDRAW_CREATE_FAILED');
  const submitted = await database.query(`select claim_id id from referral.attach_withdrawal_claims($1,$2,$3::text[])`, [self.scope, withdrawalId, claimIds]);
  if (submitted.rowCount !== allocations.length) throw new Error('REFERRAL_WITHDRAW_SUBMISSION_CONFLICT');
  const created = withdrawal.rows[0] as Record<string, unknown>;
  return {
    status: 201,
    headers: { etag: `"${String(created.version)}"` },
    body: { ...created, claim_count: allocations.length, claimed_minor: requested.toString() },
  };
}

export function allocateWithdrawal(candidates: readonly Pick<WithdrawableCommission, 'id' | 'available_minor'>[], requested: bigint): readonly WithdrawalAllocation[] {
  if (requested <= 0n) throw new Error('REFERRAL_WITHDRAW_AMOUNT_INVALID');
  let remaining = requested;
  const allocations: WithdrawalAllocation[] = [];
  for (const candidate of candidates) {
    const available = minor(candidate.available_minor, 'REFERRAL_WITHDRAW_BALANCE_INVALID');
    if (available === 0n) continue;
    const amount = available < remaining ? available : remaining;
    allocations.push({ commission: candidate.id, amount });
    remaining -= amount;
    if (remaining === 0n) break;
  }
  if (remaining !== 0n) throw new Error('REFERRAL_WITHDRAW_INSUFFICIENT');
  return Object.freeze(allocations);
}

async function resolveSelf(request: OperationRequest, database: OperationDatabase): Promise<SelfIdentity> {
  const access = requireAccess(request);
  const result = await database.query<SelfIdentity>(
    `select membership.member_id member,organization.id scope
    from access.membership membership join organization.organization organization on organization.id=membership.organization_id
    where membership.id=$1 and membership.status='active' and organization.kind='mall'`,
    [access.membership.id]
  );
  const self = result.rows[0];
  if (!self) throw new Error('REFERRAL_MEMBER_CONTEXT_INVALID');
  return self;
}

async function findReferralMember(database: OperationDatabase, scope: string, member: string) {
  return (
    await database.query<ReferralMemberRow>(
      `select id,scope_id,member_id,inviter_member_id,state,approved_by,approved_at,created_at,updated_at,version
      from referral.member where scope_id=$1 and member_id=$2`,
      [scope, member]
    )
  ).rows[0];
}

function mallScope(request: OperationRequest): string {
  const access = requireAccess(request);
  if (access.scope.kind !== 'mall') throw new Error('REFERRAL_MALL_SCOPE_REQUIRED');
  return access.scope.id;
}

function expectedVersion(request: OperationRequest): number {
  const version = request.input.expectedVersion;
  if (!Number.isSafeInteger(version) || (version as number) < 0) throw new Error('EXPECTED_VERSION_REQUIRED');
  return version as number;
}

function settingId(scope: string): string {
  return `referral-setting:${scope}`;
}

function productId(scope: string, sku: string): string {
  return `referral-product:${scope}:${sku}`;
}

function booleanField(body: Readonly<Record<string, unknown>>, field: string): boolean {
  const value = body[field];
  if (typeof value !== 'boolean') throw new Error(`VALIDATION_FAILED:${field}`);
  return value;
}

function optionalInteger(value: unknown, field: string, minimum: number): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isSafeInteger(value) || (value as number) < minimum) throw new Error(`VALIDATION_FAILED:${field}`);
  return value as number;
}

function choice<const T extends readonly string[]>(value: unknown, choices: T, code: string): T[number] {
  if (typeof value !== 'string' || !choices.includes(value)) throw new Error(code);
  return value as T[number];
}

function queryChoice<const T extends readonly string[]>(request: OperationRequest, field: string, choices: T): T[number] | null {
  const value = queryValue(request, field);
  if (value === null) return null;
  if (!choices.includes(value)) throw new Error(`QUERY_${field.toUpperCase()}_INVALID`);
  return value as T[number];
}

function queryText(request: OperationRequest, field: string, maximum: number): string | null {
  const value = queryValue(request, field);
  if (value !== null && value.length > maximum) throw new Error(`QUERY_${field.toUpperCase()}_INVALID`);
  return value;
}

function queryValue(request: OperationRequest, field: string): string | null {
  const raw = request.input.query[field];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new Error(`QUERY_${field.toUpperCase()}_INVALID`);
  return value;
}

function minor(value: unknown, code: string): bigint {
  if (typeof value === 'bigint' && value >= 0n) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  throw new Error(code);
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : {};
}

function rowResultFromRow(row: ReferralMemberRow) {
  return { status: 200, body: row, headers: { etag: `"${String(row.version)}"` } };
}

interface SelfIdentity extends Record<string, unknown> {
  readonly member: string;
  readonly scope: string;
}

interface ReferralMemberRow extends Record<string, unknown> {
  readonly state: string;
  readonly version: string | number;
}

interface BindingWinner extends Record<string, unknown> {
  readonly binding_id: string;
  readonly winner_referral_member_id: string;
  readonly created: boolean;
  readonly bound_at: string;
  readonly expires_at: string | null;
}

interface WithdrawalOwner extends Record<string, unknown> {
  readonly id: string;
  readonly member_id: string;
  readonly withdraw_min_minor: string;
  readonly withdraw_monthly_max: number | null;
}

interface WithdrawableCommission extends Record<string, unknown> {
  readonly id: string;
  readonly currency: string;
  readonly available_minor: string;
}

export interface WithdrawalAllocation {
  readonly commission: string;
  readonly amount: bigint;
}
