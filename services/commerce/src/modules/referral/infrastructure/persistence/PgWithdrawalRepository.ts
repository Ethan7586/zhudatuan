import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { DomainError } from '../../../../platform/error/DomainError';
import type { WithdrawalPosition, WithdrawalRepository } from '../../application/port/WithdrawalRepository';
export class PgWithdrawalRepository implements WithdrawalRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}
  async read(context: ReadTransactionContext, scope: string, member: string, page: Parameters<WithdrawalRepository['read']>[3]) {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query(
      `select id,member_id "memberId",state status,amount_minor "amountMinor",currency,account_ref "accountRef",
      approval_instance_id "approvalId",requested_at "requestedAt",approved_at "approvedAt",completed_at "completedAt",provider_reference "providerReference",failure_reason "failureReason",version
      from referral.withdrawalclaim where scope_id=$1 and member_id=$2 and ($3::text is null or id>$3) order by id limit $4`,
      [scope, member, page.id, page.fetch]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ ...row })));
  }
  async position(context: ReadTransactionContext, scope: string, member: string): Promise<WithdrawalPosition | null> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<WithdrawalPosition>(
      `select greatest(coalesce((select sum(amount_minor-reversed_minor) from referral.commission
        where scope_id=$1 and beneficiary_id=$2 and state='settled'),0)-coalesce((select sum(amount_minor)
        from referral.withdrawalclaim where scope_id=$1 and member_id=$2 and state in('requested','processing','paid')),0),0) "availableMinor",
      exists(select 1 from referral.commission where scope_id=$1 and beneficiary_id=$2 and state='pending' and reversed_minor>0) "hasPendingReversal",
      setting.minimum_withdrawal_minor "minimumMinor",setting.monthly_withdrawal_limit "monthlyLimit",setting.currency,
      (select count(*) from referral.withdrawalclaim where scope_id=$1 and member_id=$2 and state in('requested','processing','paid')
        and requested_at>=date_trunc('month',clock_timestamp())) "monthlyUsed",
      coalesce((select max(version) from referral.commission where scope_id=$1 and beneficiary_id=$2),1) version
      from referral.setting setting where setting.scope_id=$1 and setting.enabled`,
      [scope, member]
    );
    return result.rows[0] ? Object.freeze({ ...result.rows[0] }) : null;
  }
  async create(context: WriteTransactionContext, input: Parameters<WithdrawalRepository['create']>[1]) {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query(
      `with lock as (select pg_advisory_xact_lock(hashtextextended('referral:withdrawal:'||$1||':'||$2,0))),
      balance as (select coalesce(sum(amount_minor-reversed_minor) filter(where state='settled'),0)::bigint available,
        coalesce(max(version),1)::bigint version from referral.commission,lock where scope_id=$1 and beneficiary_id=$2),
      reserved as (select coalesce(sum(amount_minor),0)::bigint amount from referral.withdrawalclaim
        where scope_id=$1 and member_id=$2 and state in('requested','processing','paid')),
      policy as (select minimum_withdrawal_minor,monthly_withdrawal_limit,currency from referral.setting where scope_id=$1 and enabled for share),
      monthly as (select count(*)::integer used from referral.withdrawalclaim where scope_id=$1 and member_id=$2
        and state in('requested','processing','paid') and requested_at>=date_trunc('month',clock_timestamp())),
      claim as (insert into referral.withdrawalclaim(id,scope_id,member_id,amount_minor,currency,account_ref,state,approval_instance_id,requested_at,version)
        select $3,$1,$2,$4,$5,$6,'requested',$8,clock_timestamp(),1 from balance,reserved,policy,monthly
        where balance.version=$7 and balance.available-reserved.amount>=$4 and policy.minimum_withdrawal_minor<=$4 and policy.currency=$5
          and (policy.monthly_withdrawal_limit is null or monthly.used<policy.monthly_withdrawal_limit) returning *),
      movement as (insert into referral.recoverymovement(id,movement_key,scope_id,beneficiary_id,source_type,source_id,previous_state,
        next_state,direction,amount_minor,currency,actor_id,reason,created_at)
        select 'recoverymovement:'||encode(public.digest('withdrawalrequested:'||id,'sha256'),'hex'),'withdrawalrequested:'||id,
        scope_id,member_id,'withdrawal',id,'none','requested','debit',amount_minor,currency,member_id,'requested',clock_timestamp()
        from claim returning source_id)
      select claim.id,claim.member_id "memberId",claim.state status,claim.amount_minor "amountMinor",claim.currency,
      claim.account_ref "accountRef",claim.approval_instance_id "approvalId",claim.requested_at "requestedAt",claim.approved_at "approvedAt",claim.completed_at "completedAt",
      claim.provider_reference "providerReference",claim.failure_reason "failureReason",claim.version from claim join movement on movement.source_id=claim.id`,
      [input.scopeId, input.memberId, input.id, input.amountMinor, input.currency, input.accountRef, input.expectedVersion, input.approvalId]
    );
    if (!result.rows[0]) throw new DomainError('REFERRAL_WITHDRAWAL_CONFLICT');
    return Object.freeze({ ...result.rows[0] });
  }
}
