import type { ContractJsonValue } from '@shop/contract';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type {
  ManagedQualificationPolicy,
  QualificationDecisionRecord,
  QualificationPolicyImpactBasis,
  QualificationPolicyRecord,
  QualificationRepository,
} from '../../application/port/QualificationRepository';

interface PolicyRow extends Record<string, unknown> {
  readonly id: string;
  readonly name: string;
  readonly status: 'draft' | 'published' | 'retired';
  readonly active_version: number | null;
  readonly updated_at: Date;
  readonly rule: ContractJsonValue | null;
  readonly rule_hash: string | null;
  readonly published_at: Date | null;
  readonly versions: QualificationPolicyRecord['versions'];
}
interface LockedPolicyRow extends Record<string, unknown> {
  readonly id: string;
  readonly scope_id: string;
  readonly name: string;
  readonly active_version: number | null;
  readonly created_at: Date;
}
interface VersionRow extends Record<string, unknown> {
  readonly version: number;
  readonly rule: ContractJsonValue;
  readonly rule_hash: string;
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

  async policies(context: ReadTransactionContext, input: Readonly<{ scope: string; sort: string | null; id: string | null; fetch: number }>): Promise<readonly QualificationPolicyRecord[]> {
    const database = this.transactions.database(context);
    const result = await database.query<PolicyRow>(
      `select policy.id,policy.name,policy.status,policy.active_version,policy.updated_at,active.rule,active.rule_hash,active.published_at,
      coalesce((select jsonb_agg(jsonb_build_object('version',history.version,'rule_hash',history.rule_hash,'published_at',
        case when history.published_at is null then null else to_char(history.published_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
        'created_by',history.created_by) order by history.version desc) from(select version,rule_hash,published_at,created_by
        from qualification.policyversion where policy_id=policy.id order by version desc limit 20) history),'[]'::jsonb) versions
      from qualification.policy policy left join qualification.policyversion active
        on active.policy_id=policy.id and active.version=policy.active_version
      where policy.scope_id=$1 and ($2::timestamptz is null or (policy.updated_at,policy.id)<($2::timestamptz,$3))
      order by policy.updated_at desc,policy.id desc limit $4`,
      [input.scope, input.sort, input.id, input.fetch]
    );
    return Object.freeze(
      result.rows.map((row) =>
        Object.freeze({
          ...row,
          updated_at: row.updated_at.toISOString(),
          published_at: row.published_at?.toISOString() ?? null,
          versions: Object.freeze(row.versions.map((item) => Object.freeze({ ...item }))),
        })
      )
    );
  }

  async previewDecision(context: ReadTransactionContext, scope: string, member: string, resource: string): Promise<readonly QualificationDecisionRecord[]> {
    const database = this.transactions.database(context);
    const result = await database.query<QualificationDecisionRecord & Record<string, unknown>>(
      `select policy.id policy_id,policy.active_version policy_version,
      case when profile.status='active' and coalesce(active.rule->>'effect','allow')<>'deny'
        and coalesce(active.rule->'allowed','true'::jsonb)<>'false'::jsonb
        and (jsonb_typeof(active.rule->'cityCodes') is distinct from 'array' or jsonb_array_length(active.rule->'cityCodes')=0
          or active.rule->'cityCodes'?coalesce(profile.city_code,''))
        and not exists(select 1 from jsonb_array_elements_text(case when jsonb_typeof(active.rule->'requiredTags')='array' then active.rule->'requiredTags' else '[]'::jsonb end) required(code)
          where not exists(select 1 from qualification.tag tag where tag.member_id=profile.member_id and tag.code=required.code
            and(tag.effective_at is null or tag.effective_at<=clock_timestamp()) and(tag.expires_at is null or tag.expires_at>clock_timestamp())))
        and not exists(select 1 from jsonb_array_elements_text(case when jsonb_typeof(active.rule->'excludedTags')='array' then active.rule->'excludedTags' else '[]'::jsonb end) excluded(code)
          join qualification.tag tag on tag.member_id=profile.member_id and tag.code=excluded.code
          and(tag.effective_at is null or tag.effective_at<=clock_timestamp()) and(tag.expires_at is null or tag.expires_at>clock_timestamp()))
        and not exists(select 1 from qualification.subject subject where subject.policy_id=policy.id and subject.policy_version=policy.active_version
          and subject.selector?'tag' and not exists(select 1 from qualification.tag tag where tag.member_id=profile.member_id and tag.code=subject.selector->>'tag'
          and(tag.effective_at is null or tag.effective_at<=clock_timestamp()) and(tag.expires_at is null or tag.expires_at>clock_timestamp())))
        and (not exists(select 1 from qualification.resource resource where resource.policy_id=policy.id
        and resource.policy_version=policy.active_version) or exists(select 1 from qualification.resource resource where resource.policy_id=policy.id
        and resource.policy_version=policy.active_version and resource.resource_id=$3)) then 'eligible' else 'ineligible' end decision
      from qualification.policy policy join qualification.policyversion active on active.policy_id=policy.id and active.version=policy.active_version
      join qualification.profile profile on profile.scope_id=policy.scope_id and profile.member_id=$2
      where policy.scope_id=$1 and policy.status='published' order by policy.id`,
      [scope, member, resource]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ policy_id: row.policy_id, policy_version: row.policy_version, decision: row.decision })));
  }

  async previewPolicy(context: ReadTransactionContext, input: Readonly<{ scope: string; id: string; sourceVersion: number | null }>): Promise<QualificationPolicyImpactBasis | null> {
    const database = this.transactions.database(context);
    const profileResult = await database.query<{ count: number } & Record<string, unknown>>(`select count(*)::integer count from qualification.profile where scope_id=$1`, [input.scope]);
    const headResult = await database.query<
      {
        current_name: string;
        current_version: number | null;
        current_rule: ContractJsonValue | null;
        current_hash: string | null;
        source_rule: ContractJsonValue | null;
        source_hash: string | null;
      } & Record<string, unknown>
    >(
      `select policy.name current_name,policy.active_version current_version,active.rule current_rule,active.rule_hash current_hash,
      source.rule source_rule,source.rule_hash source_hash from qualification.policy policy
      left join qualification.policyversion active on active.policy_id=policy.id and active.version=policy.active_version
      left join qualification.policyversion source on source.policy_id=policy.id and source.version=coalesce($3,policy.active_version)
      where policy.id=$2 and policy.scope_id=$1`,
      [input.scope, input.id, input.sourceVersion]
    );
    const head = headResult.rows[0];
    if (!head) {
      if (input.sourceVersion !== null) return null;
      return Object.freeze({
        currentName: null,
        currentVersion: null,
        currentRule: null,
        currentHash: null,
        sourceVersion: null,
        sourceRule: null,
        sourceHash: null,
        potentialProfiles: profileResult.rows[0]?.count ?? 0,
        resourceCount: 0,
        subjectCount: 0,
        limitCount: 0,
      });
    }
    if (input.sourceVersion !== null && (head.source_rule === null || head.source_hash === null)) return null;
    const selectedVersion = input.sourceVersion ?? head.current_version;
    const counts = await database.query<{ resources: number; subjects: number; limits: number } & Record<string, unknown>>(
      `select
      (select count(*)::integer from qualification.resource where policy_id=$1 and policy_version=$2) resources,
      (select count(*)::integer from qualification.subject where policy_id=$1 and policy_version=$2) subjects,
      (select count(*)::integer from qualification.purchaselimit where policy_id=$1 and policy_version=$2) limits`,
      [input.id, selectedVersion]
    );
    const count = counts.rows[0];
    return Object.freeze({
      currentName: head.current_name,
      currentVersion: head.current_version,
      currentRule: head.current_rule,
      currentHash: head.current_hash,
      sourceVersion: input.sourceVersion,
      sourceRule: head.source_rule,
      sourceHash: head.source_hash,
      potentialProfiles: profileResult.rows[0]?.count ?? 0,
      resourceCount: count?.resources ?? 0,
      subjectCount: count?.subjects ?? 0,
      limitCount: count?.limits ?? 0,
    });
  }

  async publishPolicy(
    context: WriteTransactionContext,
    input: Readonly<{ id: string; scope: string; name: string; rule: ContractJsonValue; hash: string; actor: string; expectedVersion: number }>
  ): Promise<ManagedQualificationPolicy | null> {
    const database = this.transactions.database(context);
    const locked = await this.lock(database, input.id);
    if (!locked) {
      if (input.expectedVersion !== 0) return null;
      const inserted = await database.query<ManagedPolicyRow>(
        `with policy as(insert into qualification.policy(id,scope_id,name,status,active_version,created_at,updated_at)
        values($1,$2,$3,'published',1,clock_timestamp(),clock_timestamp()) on conflict do nothing returning *),
        version as(insert into qualification.policyversion(policy_id,version,rule,rule_hash,published_at,created_by)
        select id,1,$4::jsonb,$5,clock_timestamp(),$6 from policy returning *)
        select policy.id,policy.scope_id,policy.name,policy.status,policy.active_version,policy.created_at,policy.updated_at,version.rule_hash
        from policy join version on version.policy_id=policy.id`,
        [input.id, input.scope, input.name, JSON.stringify(input.rule), input.hash, input.actor]
      );
      return managed(inserted.rows[0], 'publish', null);
    }
    if (locked.scope_id !== input.scope || (locked.active_version ?? 0) !== input.expectedVersion) return null;
    return this.append(context, locked, locked.active_version, input.name, input.rule, input.hash, input.actor, 'publish');
  }

  async rollbackPolicy(
    context: WriteTransactionContext,
    input: Readonly<{ id: string; scope: string; version: number; actor: string; expectedVersion: number }>
  ): Promise<ManagedQualificationPolicy | null> {
    const database = this.transactions.database(context);
    const locked = await this.lock(database, input.id);
    if (!locked || locked.scope_id !== input.scope || locked.active_version !== input.expectedVersion || input.version === locked.active_version) return null;
    const source = await database.query<VersionRow>(`select version,rule,rule_hash from qualification.policyversion where policy_id=$1 and version=$2`, [input.id, input.version]);
    const selected = source.rows[0];
    if (!selected) return null;
    return this.append(context, locked, selected.version, locked.name, selected.rule, selected.rule_hash, input.actor, 'rollback');
  }

  private async lock(database: ReturnType<PgTransactionAccess['database']>, id: string): Promise<LockedPolicyRow | undefined> {
    const result = await database.query<LockedPolicyRow>(`select id,scope_id,name,active_version,created_at from qualification.policy where id=$1 for update`, [id]);
    return result.rows[0];
  }

  private async append(
    context: WriteTransactionContext,
    locked: LockedPolicyRow,
    sourceVersion: number | null,
    name: string,
    rule: ContractJsonValue,
    hash: string,
    actor: string,
    action: 'publish' | 'rollback'
  ): Promise<ManagedQualificationPolicy> {
    const database = this.transactions.database(context);
    const next = (locked.active_version ?? 0) + 1;
    await database.query(
      `insert into qualification.policyversion(policy_id,version,rule,rule_hash,published_at,created_by)
      values($1,$2,$3::jsonb,$4,clock_timestamp(),$5)`,
      [locked.id, next, JSON.stringify(rule), hash, actor]
    );
    if (sourceVersion !== null) {
      await database.query(
        `insert into qualification.resource(policy_id,policy_version,kind,resource_id)
        select policy_id,$2,kind,resource_id from qualification.resource where policy_id=$1 and policy_version=$3;
        insert into qualification.subject(policy_id,policy_version,kind,selector)
        select policy_id,$2,kind,selector from qualification.subject where policy_id=$1 and policy_version=$3;
        insert into qualification.purchaselimit(policy_id,policy_version,period,quantity,amount_minor,currency)
        select policy_id,$2,period,quantity,amount_minor,currency from qualification.purchaselimit where policy_id=$1 and policy_version=$3`,
        [locked.id, next, sourceVersion]
      );
    }
    const saved = await database.query<ManagedPolicyRow>(
      `update qualification.policy set name=$2,status='published',active_version=$3,updated_at=clock_timestamp()
      where id=$1 returning id,scope_id,name,status,active_version,created_at,updated_at,$4::text rule_hash`,
      [locked.id, name, next, hash]
    );
    const result = managed(saved.rows[0], action, action === 'rollback' ? sourceVersion : null);
    if (!result) throw new Error('QUALIFICATION_POLICY_APPEND_FAILED');
    return result;
  }
}

function managed(row: ManagedPolicyRow | undefined, action: 'publish' | 'rollback', source: number | null): ManagedQualificationPolicy | null {
  return row
    ? Object.freeze({ ...row, created_at: row.created_at.toISOString(), updated_at: row.updated_at.toISOString(), action, source_version: source })
    : null;
}
