import type { QueryResult } from 'pg';
import type { Transaction } from '../../../../foundation/persistence/UnitOfWork';
import { DomainError } from '../../../../foundation/domain/DomainError';

export class PgReferralRepository {
  constructor(private readonly transaction: Transaction) {}

  setting(scopeId: string): Promise<QueryResult> {
    return this.transaction.query(
      `select id,scope_id "scopeId",enabled,first_touch_days "firstTouchDays",rate_basis_points "rateBasisPoints",
      minimum_withdrawal_minor "minimumWithdrawalMinor",currency,version,updated_at "updatedAt"
      from referral.setting where scope_id=$1`,
      [scopeId]
    );
  }

  manageSetting(input: Readonly<{ id: string; scopeId: string; enabled: boolean; firstTouchDays: number; rateBasisPoints: number; minimumWithdrawalMinor: number; currency: string; expectedVersion: number }>): Promise<QueryResult> {
    return this.transaction.query(
      `insert into referral.setting(id,scope_id,enabled,first_touch_days,rate_basis_points,minimum_withdrawal_minor,currency,version,created_at,updated_at)
      values($1,$2,$3,$4,$5,$6,$7,1,clock_timestamp(),clock_timestamp()) on conflict(id) do update set enabled=excluded.enabled,
      first_touch_days=excluded.first_touch_days,rate_basis_points=excluded.rate_basis_points,minimum_withdrawal_minor=excluded.minimum_withdrawal_minor,
      currency=excluded.currency,version=referral.setting.version+1,updated_at=clock_timestamp()
      where referral.setting.scope_id=$2 and referral.setting.version=$8
      returning id,scope_id "scopeId",enabled,first_touch_days "firstTouchDays",rate_basis_points "rateBasisPoints",
      minimum_withdrawal_minor "minimumWithdrawalMinor",currency,version,updated_at "updatedAt"`,
      [input.id, input.scopeId, input.enabled, input.firstTouchDays, input.rateBasisPoints, input.minimumWithdrawalMinor, input.currency, input.expectedVersion]
    );
  }

  products(scopeId: string, page: Readonly<{ cursor: string | null; limit: number }>): Promise<QueryResult> {
    return this.transaction.query(
      `select id,product_id "productId",enabled,rate_basis_points "rateBasisPoints",version,updated_at "updatedAt"
      from referral.product where scope_id=$1 and ($2::text is null or id>$2) order by id limit $3`,
      [scopeId, page.cursor, page.limit]
    );
  }

  manageProduct(input: Readonly<{ id: string; scopeId: string; productId: string; enabled: boolean; rateBasisPoints: number; expectedVersion: number }>): Promise<QueryResult> {
    return this.transaction.query(
      `insert into referral.product(id,scope_id,product_id,enabled,rate_basis_points,version,created_at,updated_at)
      values($1,$2,$3,$4,$5,1,clock_timestamp(),clock_timestamp()) on conflict(id) do update set enabled=excluded.enabled,
      rate_basis_points=excluded.rate_basis_points,version=referral.product.version+1,updated_at=clock_timestamp()
      where referral.product.scope_id=$2 and referral.product.product_id=$3 and referral.product.version=$6
      returning id,product_id "productId",enabled,rate_basis_points "rateBasisPoints",version,updated_at "updatedAt"`,
      [input.id, input.scopeId, input.productId, input.enabled, input.rateBasisPoints, input.expectedVersion]
    );
  }

  members(scopeId: string, page: Readonly<{ cursor: string | null; limit: number }>): Promise<QueryResult> {
    return this.transaction.query(
      `select id,member_id "memberId",state status,applied_at "appliedAt",approved_at "approvedAt",disqualified_at "disqualifiedAt",version
      from referral.member where scope_id=$1 and ($2::text is null or id>$2) order by id limit $3`,
      [scopeId, page.cursor, page.limit]
    );
  }

  member(scopeId: string, id: string): Promise<QueryResult> {
    return this.transaction.query(
      `select id,scope_id "scopeId",member_id "memberId",state,version,maker_id "makerId"
      from referral.member where scope_id=$1 and id=$2 for update`,
      [scopeId, id]
    );
  }

  applyMember(input: Readonly<{ id: string; scopeId: string; memberId: string; displayName: string; mobile: string; makerId: string; reason: string }>): Promise<QueryResult> {
    return this.transaction.query(
      `insert into referral.member(id,scope_id,member_id,display_name,mobile_masked,state,maker_id,reason,applied_at,version)
      values($1,$2,$3,$4,$5,'applied',$6,$7,clock_timestamp(),1)
      on conflict(scope_id,member_id) do nothing
      returning id,member_id "memberId",state status,applied_at "appliedAt",approved_at "approvedAt",disqualified_at "disqualifiedAt",version`,
      [input.id, input.scopeId, input.memberId, input.displayName, maskMobile(input.mobile), input.makerId, input.reason]
    );
  }

  decideMember(input: Readonly<{ id: string; scopeId: string; actorId: string; expectedVersion: number; next: 'active' | 'disqualified'; reason: string }>): Promise<QueryResult> {
    const previous = input.next === 'active' ? 'applied' : 'active';
    return this.transaction.query(
      `update referral.member set state=$4,checker_id=$3,reason=$5,approved_at=case when $4='active' then clock_timestamp() else approved_at end,
      disqualified_at=case when $4='disqualified' then clock_timestamp() else null end,version=version+1
      where id=$1 and scope_id=$2 and state=$6 and maker_id<>$3 and version=$7
      returning id,member_id "memberId",state status,applied_at "appliedAt",approved_at "approvedAt",disqualified_at "disqualifiedAt",version`,
      [input.id, input.scopeId, input.actorId, input.next, input.reason, previous, input.expectedVersion]
    );
  }

  bindings(scopeId: string, customerId: string | null, page: Readonly<{ cursor: string | null; limit: number }>): Promise<QueryResult> {
    return this.transaction.query(
      `select id,promoter_id "promoterId",customer_id "memberId",source,bound_at "boundAt",version
      from referral.binding where scope_id=$1 and ($2::text is null or customer_id=$2) and ($3::text is null or id>$3) order by id limit $4`,
      [scopeId, customerId, page.cursor, page.limit]
    );
  }

  binding(scopeId: string, customerId: string): Promise<QueryResult> {
    return this.transaction.query(
      `select id,scope_id "scopeId",customer_id "customerId",promoter_id "promoterId",
      token_fingerprint "tokenFingerprint",bound_at "boundAt",version
      from referral.binding where scope_id=$1 and customer_id=$2 for share`,
      [scopeId, customerId]
    );
  }

  bind(input: Readonly<{ id: string; scopeId: string; customerId: string; promoterId: string; fingerprint: string; source: string }>): Promise<QueryResult> {
    return this.transaction.query(
      `insert into referral.binding(id,scope_id,customer_id,promoter_id,token_fingerprint,source,bound_at,version)
      select $1,$2,$3,promoter.id,$5,$6,clock_timestamp(),1 from referral.member promoter
      join referral.setting setting on setting.scope_id=promoter.scope_id and setting.enabled
      where promoter.id=$4 and promoter.scope_id=$2 and promoter.state='active' and promoter.member_id<>$3
      on conflict(scope_id,customer_id) do nothing
      returning id,promoter_id "promoterId",customer_id "memberId",source,bound_at "boundAt",version`,
      [input.id, input.scopeId, input.customerId, input.promoterId, input.fingerprint, input.source]
    );
  }
}

function maskMobile(value: string): string {
  if (!/^\+?\d{6,20}$/.test(value)) throw new DomainError('VALIDATION_FAILED', { field: 'mobile' });
  return `${value.slice(0, 3)}****${value.slice(-4)}`;
}
