import { DomainError } from '../../foundation/domain/DomainError';
import { randomUUID } from 'node:crypto';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess, rowResult } from '../../foundation/application/ModuleOperations';
import { bodyRecord, integerField } from '../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';

export function pricingOperations(context: ModuleContext): ModuleOperations {
  const pool = context.service(DATABASE_POOL);
  return new ModuleOperations('pricing', pool, context.service(AUDIT_SINK), {
    'pricing.rules.create': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const result = await database.query(
        `insert into pricing.rule(id,scope_id,priority,kind,condition,effect,version,status)
        values($1,$2,$3,$4,$5::jsonb,$6::jsonb,1,'draft') returning *`,
        [`rule:${randomUUID()}`, access.scope.id, integerField(body, 'priority'), body.kind ?? 'markup', JSON.stringify(body.condition ?? {}), JSON.stringify(body.effect ?? {})]
      );
      return rowResult(result, 201);
    },
    'pricing.rules.publish': async (request, database) => {
      requireAccess(request);
      const result = await database.query(
        `update pricing.rule set status='published',effective_at=clock_timestamp()
        where id=$1 and status='draft' and ($2::integer is null or version=$2) returning *`,
        [request.input.path.ruleid!, request.input.expectedVersion ?? null]
      );
      if (!result.rows[0]) throw new DomainError('VERSION_CONFLICT');
      return rowResult(result);
    },
  });
}
