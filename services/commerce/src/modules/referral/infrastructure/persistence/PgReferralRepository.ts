import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { DomainError } from '../../../../platform/error/DomainError';
import type { ReferralMemberPort } from '../../../member/public';
import type { ReferralRepository } from '../../application/port/ReferralRepository';
export class PgReferralRepository implements ReferralRepository {
  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly memberPort: ReferralMemberPort
  ) {}
  eligible(context: ReadTransactionContext, scope: string, membership: string) {
    const database = this.transactions.database(context);
    return this.memberPort.eligible(context, scope, membership);
  }
  async setting(context: ReadTransactionContext, scope: string) {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query(
      `select id,scope_id "scopeId",enabled,recruit_enabled "recruitEnabled",review_required "reviewRequired",reward_enabled "rewardEnabled",
      binding_mode "bindingMode",first_touch_days "firstTouchDays",freeze_days "freezeDays",settlement_trigger "settlementTrigger",rate_basis_points "rateBasisPoints",
      minimum_withdrawal_minor "minimumWithdrawalMinor",monthly_withdrawal_limit "monthlyWithdrawalLimit",currency,version,updated_at "updatedAt" from referral.setting where scope_id=$1`,
      [scope]
    );
    return result.rows[0] ? Object.freeze({ ...result.rows[0] }) : null;
  }
  async manageSetting(context: WriteTransactionContext, input: Parameters<ReferralRepository['manageSetting']>[1]) {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query(
      `insert into referral.setting(id,scope_id,enabled,recruit_enabled,review_required,reward_enabled,binding_mode,first_touch_days,freeze_days,
      settlement_trigger,rate_basis_points,minimum_withdrawal_minor,monthly_withdrawal_limit,currency,version,created_at,updated_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,1,clock_timestamp(),clock_timestamp()) on conflict(id) do update set enabled=excluded.enabled,
      recruit_enabled=excluded.recruit_enabled,review_required=excluded.review_required,reward_enabled=excluded.reward_enabled,binding_mode=excluded.binding_mode,
      first_touch_days=excluded.first_touch_days,freeze_days=excluded.freeze_days,settlement_trigger=excluded.settlement_trigger,rate_basis_points=excluded.rate_basis_points,
      minimum_withdrawal_minor=excluded.minimum_withdrawal_minor,monthly_withdrawal_limit=excluded.monthly_withdrawal_limit,currency=excluded.currency,
      version=referral.setting.version+1,updated_at=clock_timestamp() where referral.setting.scope_id=$2 and referral.setting.version=$15
      returning id,scope_id "scopeId",enabled,recruit_enabled "recruitEnabled",review_required "reviewRequired",reward_enabled "rewardEnabled",
      binding_mode "bindingMode",first_touch_days "firstTouchDays",freeze_days "freezeDays",settlement_trigger "settlementTrigger",rate_basis_points "rateBasisPoints",
      minimum_withdrawal_minor "minimumWithdrawalMinor",monthly_withdrawal_limit "monthlyWithdrawalLimit",currency,version,updated_at "updatedAt"`,
      [
        input.id,
        input.scopeId,
        input.enabled,
        input.recruitEnabled,
        input.reviewRequired,
        input.rewardEnabled,
        input.bindingMode,
        input.firstTouchDays,
        input.freezeDays,
        input.settlementTrigger,
        input.rateBasisPoints,
        input.minimumWithdrawalMinor,
        input.monthlyWithdrawalLimit,
        input.currency,
        input.expectedVersion,
      ]
    );
    return required(result.rows[0], 'VERSION_CONFLICT');
  }
  async products(context: ReadTransactionContext, scope: string, page: Parameters<ReferralRepository['products']>[2]) {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query(
      `select id,product_id "productId",enabled,rate_basis_points "rateBasisPoints",reward_basis_points "rewardBasisPoints",version,updated_at "updatedAt"
      from referral.product where scope_id=$1 and ($2::text is null or id>$2) order by id limit $3`,
      [scope, page.id, page.fetch]
    );
    return rows(result.rows);
  }
  async manageProduct(context: WriteTransactionContext, input: Parameters<ReferralRepository['manageProduct']>[1]) {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query(
      `insert into referral.product(id,scope_id,product_id,enabled,rate_basis_points,reward_basis_points,version,created_at,updated_at)
      values($1,$2,$3,$4,$5,$6,1,clock_timestamp(),clock_timestamp()) on conflict(id) do update set enabled=excluded.enabled,
      rate_basis_points=excluded.rate_basis_points,reward_basis_points=excluded.reward_basis_points,version=referral.product.version+1,updated_at=clock_timestamp()
      where referral.product.scope_id=$2 and referral.product.product_id=$3 and referral.product.version=$7
      returning id,product_id "productId",enabled,rate_basis_points "rateBasisPoints",reward_basis_points "rewardBasisPoints",version,updated_at "updatedAt"`,
      [input.id, input.scopeId, input.productId, input.enabled, input.rateBasisPoints, input.rewardBasisPoints, input.expectedVersion]
    );
    return required(result.rows[0], 'VERSION_CONFLICT');
  }
  async members(context: ReadTransactionContext, scope: string, page: Parameters<ReferralRepository['members']>[2]) {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query(
      `select id,member_id "memberId",state status,applied_at "appliedAt",approved_at "approvedAt",disqualified_at "disqualifiedAt",version
      from referral.member where scope_id=$1 and ($2::text is null or id>$2) order by id limit $3`,
      [scope, page.id, page.fetch]
    );
    return rows(result.rows);
  }
  async member(context: WriteTransactionContext, scope: string, id: string) {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<{
      id: string;
      scopeId: string;
      memberId: string;
      state: 'applied' | 'active' | 'disqualified';
      version: number;
      makerId: string;
    }>(`select id,scope_id "scopeId",member_id "memberId",state,version,maker_id "makerId" from referral.member where scope_id=$1 and id=$2 for update`, [scope, id]);
    return result.rows[0] ? Object.freeze({ ...result.rows[0] }) : null;
  }
  async applyMember(context: WriteTransactionContext, input: Parameters<ReferralRepository['applyMember']>[1]) {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query(
      `insert into referral.member(id,scope_id,member_id,display_name,mobile_masked,state,maker_id,checker_id,reason,applied_at,approved_at,version)
      values($1,$2,$3,$4,$5,$8,$6,case when $8='active' then 'system:referral' end,$7,clock_timestamp(),case when $8='active' then clock_timestamp() end,1) on conflict(scope_id,member_id) do nothing
      returning id,member_id "memberId",state status,applied_at "appliedAt",approved_at "approvedAt",disqualified_at "disqualifiedAt",version`,
      [input.id, input.scopeId, input.memberId, input.displayName, maskMobile(input.mobile), input.makerId, input.reason, input.state]
    );
    return required(result.rows[0], 'REFERRAL_NOT_ELIGIBLE');
  }
  async decideMember(context: WriteTransactionContext, input: Parameters<ReferralRepository['decideMember']>[1]) {
    const database = this.transactions.database(context);
    const previous = input.next === 'active' ? 'applied' : 'active';
    const result = await this.transactions.database(context).query(
      `update referral.member set state=$4,checker_id=$3,reason=$5,approved_at=case when $4='active' then clock_timestamp() else approved_at end,
      disqualified_at=case when $4='disqualified' then clock_timestamp() else null end,version=version+1
      where id=$1 and scope_id=$2 and state=$6 and maker_id<>$3 and version=$7
      returning id,member_id "memberId",state status,applied_at "appliedAt",approved_at "approvedAt",disqualified_at "disqualifiedAt",version`,
      [input.id, input.scopeId, input.actorId, input.next, input.reason, previous, input.expectedVersion]
    );
    return required(result.rows[0], 'VERSION_CONFLICT');
  }
  async bindings(context: ReadTransactionContext, scope: string, customer: string | null, page: Parameters<ReferralRepository['bindings']>[3]) {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query(
      `select id,promoter_id "promoterId",customer_id "memberId",source,bound_at "boundAt",expires_at "expiresAt",state status,version
      from referral.binding where scope_id=$1 and ($2::text is null or customer_id=$2) and ($3::text is null or id>$3) order by id limit $4`,
      [scope, customer, page.id, page.fetch]
    );
    return rows(result.rows);
  }
  async binding(context: WriteTransactionContext, scope: string, customer: string) {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query(
      `select id,scope_id "scopeId",customer_id "customerId",promoter_id "promoterId",promoter_member_id "promoterMemberId",
      token_fingerprint "tokenFingerprint",source,bound_at "boundAt",expires_at "expiresAt",state,version
      from referral.binding where scope_id=$1 and customer_id=$2 and state='active' for update`,
      [scope, customer]
    );
    return result.rows[0] ? Object.freeze({ ...result.rows[0] }) : null;
  }
  async attribution(context: WriteTransactionContext, scope: string, promoter: string, observedAt: string) {
    const result = await this.transactions.database(context).query<{ promoterMemberId: string; ancestors: string[] }>(
      `with recursive relation(member_id,depth,path) as (
        select member.member_id,1,array[member.member_id] from referral.member member
        where member.scope_id=$1 and member.id=$2 and member.state='active'
        union all
        select parent.member_id,relation.depth+1,relation.path||parent.member_id from relation
        join referral.binding binding on binding.scope_id=$1 and binding.customer_id=relation.member_id and binding.state='active'
          and binding.bound_at<=$3::timestamptz and (binding.expires_at is null or binding.expires_at>$3::timestamptz)
        join referral.member parent on parent.scope_id=binding.scope_id and parent.id=binding.promoter_id and parent.state='active'
        where relation.depth<32 and not(parent.member_id=any(relation.path))
      ) select min(member_id) filter(where depth=1) "promoterMemberId",array_agg(member_id order by depth) ancestors from relation`,
      [scope, promoter, observedAt]
    );
    const row = result.rows[0];
    return row?.promoterMemberId ? Object.freeze({ promoterMemberId: row.promoterMemberId, ancestors: Object.freeze(row.ancestors) }) : null;
  }
  async bind(context: WriteTransactionContext, input: Parameters<ReferralRepository['bind']>[1]) {
    const database = this.transactions.database(context);
    await database.query(`select pg_advisory_xact_lock(hashtextextended($1,0))`, [`referral:binding:${input.scopeId}:${input.customerId}`]);
    await database.query(
      `update referral.binding set state='superseded',superseded_at=$2::timestamptz,version=version+1
      where scope_id=$1 and customer_id=$3 and state='active' and expires_at is not null and expires_at<=$2::timestamptz`,
      [input.scopeId, input.boundAt, input.customerId]
    );
    const result = await database.query(
      `insert into referral.binding(id,scope_id,customer_id,promoter_id,promoter_member_id,token_fingerprint,source,bound_at,expires_at,state,version)
      select $1,$2,$3,promoter.id,promoter.member_id,$5,$6,$7::timestamptz,$8::timestamptz,'active',1 from referral.member promoter
      join referral.setting setting on setting.scope_id=promoter.scope_id and setting.enabled
      where promoter.id=$4 and promoter.scope_id=$2 and promoter.state='active' and promoter.member_id=$9 and promoter.member_id<>$3
      on conflict do nothing
      returning id,promoter_id "promoterId",customer_id "memberId",source,bound_at "boundAt",expires_at "expiresAt",state status,version`,
      [input.id, input.scopeId, input.customerId, input.promoterId, input.fingerprint, input.source, input.boundAt, input.expiresAt, input.promoterMemberId]
    );
    return required(result.rows[0], 'REFERRAL_ALREADY_BOUND');
  }
  async link(context: ReadTransactionContext, scope: string, member: string) {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<{
      id: string;
      version: number;
      first_touch_days: number;
    }>(
      `select referralmember.id,setting.version,setting.first_touch_days from referral.member referralmember
      join referral.setting setting on setting.scope_id=referralmember.scope_id and setting.enabled
      where referralmember.scope_id=$1 and referralmember.member_id=$2 and referralmember.state='active'`,
      [scope, member]
    );
    const row = result.rows[0];
    return row ? Object.freeze({ promoterId: row.id, settingVersion: row.version, firstTouchDays: row.first_touch_days }) : null;
  }
}
function required(row: Readonly<Record<string, unknown>> | undefined, code: 'VERSION_CONFLICT' | 'REFERRAL_NOT_ELIGIBLE' | 'REFERRAL_ALREADY_BOUND') {
  if (!row) throw new DomainError(code);
  return Object.freeze({ ...row });
}
function rows(value: readonly Readonly<Record<string, unknown>>[]) {
  return Object.freeze(value.map((row) => Object.freeze({ ...row })));
}
function maskMobile(value: string): string {
  if (!/^\+?\d{6,20}$/.test(value)) throw new DomainError('VALIDATION_FAILED', { field: 'mobile' });
  return `${value.slice(0, 3)}****${value.slice(-4)}`;
}
