import type { OperationId } from '@shop/contract';
import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess, type OperationActions } from '../../../foundation/application/ModuleOperations';
import { keysetResult, queryPage } from '../../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../../foundation/persistence/Pool';

export const EXPERIENCE_OPERATOR_READ_OPERATION_IDS = Object.freeze([
  'experience.applications.read',
] as const satisfies readonly OperationId[]);

export function experienceOperatorReadActions(): OperationActions {
  return {
    'experience.applications.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const application = queryText(request.input.query.application);
      const result = await database.query(`select application.id,application.scope_id,application.code,application.public_slug,
        application.name,application.status,application.version,application.created_at,application.updated_at,
        head.id head_id,head.sequence head_sequence,head.schema_version head_schema_version,
        head.configuration head_configuration,head.validation_state head_validation_state,head.reason head_reason,
        head.created_at head_created_at,published.id published_id,published.sequence published_sequence,
        published.schema_version published_schema_version,published.configuration published_configuration,
        published.validation_state published_validation_state,published.reason published_reason,
        published.created_at published_created_at,binding.domain,binding.mall_id,binding.pool_id,
        coalesce(history.items,'[]'::jsonb) history from experience.application application
        left join experience.version head on head.id=application.head_version_id
        left join lateral(select version.* from experience.release release join experience.version version on version.id=release.version_id
          where release.application_id=application.id and release.state in('active','scheduled')
          order by case release.state when 'active' then 0 else 1 end,release.effective_at desc,release.id desc limit 1) published on true
        left join lateral(select domain,mall_id,pool_id from experience.binding where application_id=application.id order by domain limit 1) binding on true
        left join lateral(select jsonb_agg(jsonb_build_object('id',version.id,'sequence',version.sequence,
          'schemaVersion',version.schema_version,'configuration',version.configuration,'validationState',version.validation_state,
          'reason',version.reason,'createdAt',version.created_at,'lifecycle',case when exists(select 1 from experience.release release
            where release.version_id=version.id and release.state in('active','scheduled')) then 'published' else 'draft' end)
          order by version.sequence desc) items from experience.version version where version.application_id=application.id) history on true
        where exists(select 1 from organization.unitclosure closure where closure.ancestor_id=$1
          and closure.descendant_id=application.scope_id) and ($2='' or application.id=$2)
        and ($3::timestamptz is null or (application.updated_at,application.id)<($3::timestamptz,$4))
        order by application.updated_at desc,application.id desc limit $5`,
      [access.scope.id, application, page.sort, page.id, page.fetch]);
      return keysetResult(result, page, 'updated_at');
    },
  };
}

export function experienceOperatorReadOperations(context: ModuleContext): ModuleOperations {
  return new ModuleOperations('experience', context.container.get(DATABASE_POOL), context.container.get(AUDIT_SINK),
    experienceOperatorReadActions(), EXPERIENCE_OPERATOR_READ_OPERATION_IDS);
}

function queryText(value: string | readonly string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 255) ?? '';
}
