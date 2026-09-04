import type { OperationId } from '@shop/contract';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import type { OperationRequest } from '../../foundation/application/OperationHandler';
import { ModuleOperations, requireAccess, rowResult, type OperationActions } from '../../foundation/application/ModuleOperations';
import { keysetResult, queryPage } from '../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';

const MEMBER_STATES = ['pending', 'active', 'disqualified'] as const;
const COMMISSION_STATES = ['pending', 'settling', 'settled', 'reversed'] as const;
const HELD_CLAIM_STATES = "'reserved','submitted','approved','processing','paid','failed','uncertain'";

export const REFERRAL_OPERATOR_READ_OPERATION_IDS = Object.freeze([
  'referral.settings.read',
  'referral.products.read',
  'referral.members.read',
  'referral.bindings.read',
  'referral.commissions.read',
] as const satisfies readonly OperationId[]);

export function referralOperatorReadActions(): OperationActions {
  return {
    'referral.settings.read': async (request, database) => {
      const scope = scopeId(request);
      const result = await database.query(
        `select id,scope_id,enabled,recruit_enabled,review_required,reward_enabled,binding_mode,binding_days,
          settle_trigger,settle_delay_days,withdraw_min_minor::text withdraw_min_minor,
          withdraw_monthly_max,created_at,updated_at,version
        from referral.setting where scope_id=$1`,
        [scope],
      );
      if (result.rows[0]) return rowResult(result);
      return {
        status: 200,
        headers: { etag: '"0"' },
        body: {
          id: `referral-setting:${scope}`,
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
    'referral.products.read': async (request, database) => {
      const scope = scopeId(request);
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
        [scope, page.sort, page.id, page.fetch],
      );
      return keysetResult(result, page, 'updated_at');
    },
    'referral.members.read': async (request, database) => {
      const scope = scopeId(request);
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
        [scope, state, page.sort, page.id, page.fetch],
      );
      return keysetResult(result, page, 'updated_at');
    },
    'referral.bindings.read': async (request, database) => {
      const scope = scopeId(request);
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
        [scope, page.sort, page.id, page.fetch],
      );
      return keysetResult(result, page, 'bound_at');
    },
    'referral.commissions.read': async (request, database) => {
      const scope = scopeId(request);
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
        [scope, state, order, beneficiary, page.sort, page.id, page.fetch],
      );
      return keysetResult(result, page, 'created_at');
    },
  };
}

export function referralOperatorReadOperations(context: ModuleContext): ModuleOperations {
  return new ModuleOperations('referral', context.container.get(DATABASE_POOL), context.container.get(AUDIT_SINK),
    referralOperatorReadActions(), REFERRAL_OPERATOR_READ_OPERATION_IDS);
}

function scopeId(request: OperationRequest): string {
  return requireAccess(request).scope.id;
}

function queryChoice<const T extends readonly string[]>(request: OperationRequest, field: string, choices: T): T[number] | null {
  const value = queryText(request, field, 255);
  if (value === null) return null;
  if (!choices.includes(value)) throw new Error(`QUERY_${field.toUpperCase()}_INVALID`);
  return value as T[number];
}

function queryText(request: OperationRequest, field: string, maximum: number): string | null {
  const raw = request.input.query[field];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > maximum) throw new Error(`QUERY_${field.toUpperCase()}_INVALID`);
  return value;
}
