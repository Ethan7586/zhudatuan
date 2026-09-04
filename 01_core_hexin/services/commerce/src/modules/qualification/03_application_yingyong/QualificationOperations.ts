import { createHash, randomUUID } from 'node:crypto';
import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess, rowResult } from '../../../foundation/application/ModuleOperations';
import { bodyRecord, keysetResult, queryPage, textField } from '../../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../../foundation/persistence/Pool';

export function qualificationOperations(context: ModuleContext): ModuleOperations {
  const pool = context.container.get(DATABASE_POOL);
  return new ModuleOperations('qualification', pool, context.container.get(AUDIT_SINK), {
    'qualification.center.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request, 200);
      const result = await database.query(`select policy.id,policy.name,policy.status,policy.active_version,policy.updated_at,version.rule,version.published_at
        from qualification.policy policy left join qualification.policyversion version on version.policy_id=policy.id and version.version=policy.active_version
        where policy.scope_id=$1 and ($2::timestamptz is null or (policy.updated_at,policy.id)<($2::timestamptz,$3))
        order by policy.updated_at desc,policy.id desc limit $4`, [access.scope.id, page.sort, page.id, page.fetch]);
      return keysetResult(result, page, 'updated_at');
    },
    'qualification.decisions.preview': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const result = await database.query(`select policy.id policy_id,policy.active_version policy_version,
        case when profile.status='active' and not exists(select 1 from qualification.resource resource where resource.policy_id=policy.id
          and resource.policy_version=policy.active_version and resource.resource_id<>$3) then 'eligible' else 'ineligible' end decision
        from qualification.policy policy join qualification.profile profile on profile.scope_id=policy.scope_id and profile.member_id=$2
        where policy.scope_id=$1 and policy.status='published' order by policy.id`, [access.scope.id, textField(body, 'member'), textField(body, 'resource')]);
      return { status: 200, body: { decisions: result.rows } };
    },
    'qualification.policies.manage': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const id = request.input.path.policyid!;
      const rule = body.rule;
      if (rule === null || typeof rule !== 'object' || Array.isArray(rule)) throw new Error('VALIDATION_FAILED:rule');
      const hash = createHash('sha256').update(JSON.stringify(rule)).digest('hex');
      const result = await database.query(`with target as (
          insert into qualification.policy(id,scope_id,name,status,active_version,created_at,updated_at) values($1,$2,$3,'published',1,clock_timestamp(),clock_timestamp())
          on conflict(id) do update set name=excluded.name,status='published',active_version=coalesce(qualification.policy.active_version,0)+1,updated_at=clock_timestamp()
          where qualification.policy.scope_id=$2 returning *
        ), version as (insert into qualification.policyversion(policy_id,version,rule,rule_hash,published_at,created_by)
          select id,active_version,$4::jsonb,$5,clock_timestamp(),$6 from target returning *) select target.*,version.rule_hash from target join version on true`,
      [id, access.scope.id, textField(body, 'name'), JSON.stringify(rule), hash, access.actor.id]);
      return rowResult(result);
    },
  });
}
