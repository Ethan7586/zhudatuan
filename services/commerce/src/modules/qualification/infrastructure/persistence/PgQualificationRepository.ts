import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ContractJsonValue } from '@shop/contract';
import type { ManagedQualificationPolicy, QualificationDecisionRecord, QualificationPolicyRecord, QualificationRepository } from '../../application/port/QualificationRepository';
interface PolicyRow extends Record<string, unknown> {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly active_version: number;
  readonly updated_at: Date;
  readonly rule: ContractJsonValue | null;
  readonly published_at: Date | null;
}
interface ManagedPolicyRow extends Record<string, unknown> {
  readonly id: string;
  readonly scope_id: string;
  readonly name: string;
  readonly status: 'published';
  readonly active_version: number;
  readonly created_at: Date;
  readonly updated_at: Date;
  readonly rule_hash: string;
}
export class PgQualificationRepository implements QualificationRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}
  async policies(
    context: WriteTransactionContext,
    input: Readonly<{
      scope: string;
      sort: string | null;
      id: string | null;
      fetch: number;
    }>
  ): Promise<readonly QualificationPolicyRecord[]> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<PolicyRow>(
      `select policy.id,policy.name,policy.status,policy.active_version,policy.updated_at,version.rule,version.published_at
      from qualification.policy policy left join qualification.policyversion version
        on version.policy_id=policy.id and version.version=policy.active_version
      where policy.scope_id=$1 and ($2::timestamptz is null or (policy.updated_at,policy.id)<($2::timestamptz,$3))
      order by policy.updated_at desc,policy.id desc limit $4`,
      [input.scope, input.sort, input.id, input.fetch]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ ...row, updated_at: row.updated_at.toISOString(), published_at: row.published_at?.toISOString() ?? null })));
  }
  async preview(context: ReadTransactionContext, scope: string, member: string, resource: string): Promise<readonly QualificationDecisionRecord[]> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<QualificationDecisionRecord & Record<string, unknown>>(
      `select policy.id policy_id,policy.active_version policy_version,
      case when profile.status='active' and not exists(select 1 from qualification.resource resource where resource.policy_id=policy.id
        and resource.policy_version=policy.active_version and resource.resource_id<>$3) then 'eligible' else 'ineligible' end decision
      from qualification.policy policy join qualification.profile profile on profile.scope_id=policy.scope_id and profile.member_id=$2
      where policy.scope_id=$1 and policy.status='published' order by policy.id`,
      [scope, member, resource]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ policy_id: row.policy_id, policy_version: row.policy_version, decision: row.decision })));
  }
  async savePolicy(
    context: WriteTransactionContext,
    input: Readonly<{
      id: string;
      scope: string;
      name: string;
      rule: ContractJsonValue;
      hash: string;
      actor: string;
    }>
  ): Promise<ManagedQualificationPolicy> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<ManagedPolicyRow>(
      `with target as (
        insert into qualification.policy(id,scope_id,name,status,active_version,created_at,updated_at)
        values($1,$2,$3,'published',1,clock_timestamp(),clock_timestamp())
        on conflict(id) do update set name=excluded.name,status='published',active_version=coalesce(qualification.policy.active_version,0)+1,
          updated_at=clock_timestamp() where qualification.policy.scope_id=$2 returning *
      ), version as (
        insert into qualification.policyversion(policy_id,version,rule,rule_hash,published_at,created_by)
        select id,active_version,$4::jsonb,$5,clock_timestamp(),$6 from target returning *
      ) select target.id,target.scope_id,target.name,target.status,target.active_version,target.created_at,target.updated_at,version.rule_hash
      from target join version on true`,
      [input.id, input.scope, input.name, JSON.stringify(input.rule), input.hash, input.actor]
    );
    const row = result.rows[0];
    if (!row) throw new Error('QUALIFICATION_POLICY_SAVE_FAILED');
    return Object.freeze({ ...row, created_at: row.created_at.toISOString(), updated_at: row.updated_at.toISOString() });
  }
}
