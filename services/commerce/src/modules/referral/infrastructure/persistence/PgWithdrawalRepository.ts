import type { QueryResult } from 'pg';
import type { Transaction } from '../../../../foundation/persistence/UnitOfWork';

export class PgWithdrawalRepository {
  constructor(private readonly transaction: Transaction) {}

  read(scopeId: string, memberId: string, cursor: string | null, limit: number): Promise<QueryResult> {
    return this.transaction.query(
      `select id,member_id "memberId",state status,amount_minor "amountMinor",currency,account_ref "accountRef",
      requested_at "requestedAt",completed_at "completedAt",failure_reason "failureReason",version
      from referral.withdrawalclaim where scope_id=$1 and member_id=$2 and ($3::text is null or id>$3) order by id limit $4`,
      [scopeId, memberId, cursor, limit]
    );
  }

  position(scopeId: string, memberId: string): Promise<QueryResult> {
    return this.transaction.query(
      `select greatest(coalesce(sum(commission.amount_minor-commission.reversed_minor)
        filter(where commission.state in('available','settled')),0)-coalesce(reserved.amount,0),0) "availableMinor",
      coalesce(bool_or(commission.state='pending' and commission.reversed_minor>0),false) "hasPendingReversal",
      setting.minimum_withdrawal_minor "minimumMinor",setting.currency,
      coalesce(max(commission.version),1) version
      from referral.setting setting
      left join referral.commission commission on commission.scope_id=setting.scope_id and commission.beneficiary_id=$2
      left join lateral (
        select coalesce(sum(claim.amount_minor),0) amount from referral.withdrawalclaim claim
        where claim.scope_id=$1 and claim.member_id=$2 and claim.state in('requested','processing','paid')
      ) reserved on true
      where setting.scope_id=$1 and setting.enabled
      group by setting.minimum_withdrawal_minor,setting.currency,reserved.amount`,
      [scopeId, memberId]
    );
  }

  create(input: Readonly<{ id: string; scopeId: string; memberId: string; amountMinor: number; currency: string; accountRef: string; expectedVersion: number }>): Promise<QueryResult> {
    return this.transaction.query(
      `with lock as (
        select pg_advisory_xact_lock(hashtextextended('referral:withdrawal:'||$1||':'||$2,0))
      ), balance as (
        select coalesce(sum(amount_minor-reversed_minor) filter(where state in('available','settled')),0)::bigint available,
        coalesce(max(version),1)::bigint version from referral.commission,lock where scope_id=$1 and beneficiary_id=$2
      ), reserved as (
        select coalesce(sum(amount_minor),0)::bigint amount from referral.withdrawalclaim
        where scope_id=$1 and member_id=$2 and state in('requested','processing','paid')
      ), policy as (
        select minimum_withdrawal_minor,currency from referral.setting where scope_id=$1 and enabled for share
      ), claim as (
        insert into referral.withdrawalclaim(id,scope_id,member_id,amount_minor,currency,account_ref,state,requested_at,version)
        select $3,$1,$2,$4,$5,$6,'requested',clock_timestamp(),1 from balance,reserved,policy
        where balance.version=$7 and balance.available-reserved.amount>=$4
          and policy.minimum_withdrawal_minor<=$4 and policy.currency=$5 returning *
      ), movement as (
        insert into referral.recoverymovement(id,movement_key,scope_id,beneficiary_id,source_type,source_id,previous_state,
          next_state,direction,amount_minor,currency,actor_id,reason,created_at)
        select 'recoverymovement:'||encode(public.digest('withdrawalrequested:'||id,'sha256'),'hex'),
          'withdrawalrequested:'||id,scope_id,member_id,'withdrawal',id,'none','requested','debit',amount_minor,currency,
          member_id,'requested',clock_timestamp() from claim returning source_id
      ) select claim.id,claim.member_id "memberId",claim.state status,claim.amount_minor "amountMinor",claim.currency,
        claim.account_ref "accountRef",claim.requested_at "requestedAt",claim.completed_at "completedAt",
        claim.failure_reason "failureReason",claim.version from claim join movement on movement.source_id=claim.id`,
      [input.scopeId, input.memberId, input.id, input.amountMinor, input.currency, input.accountRef, input.expectedVersion]
    );
  }

  claim(scopeId: string, limit: number): Promise<QueryResult> {
    return this.transaction.query(
      `with target as (select id from referral.withdrawalclaim where scope_id=$1 and state='requested'
      order by requested_at,id for update skip locked limit $2)
      update referral.withdrawalclaim claim set state='processing',version=version+1 from target where claim.id=target.id returning claim.*`,
      [scopeId, limit]
    );
  }
}
