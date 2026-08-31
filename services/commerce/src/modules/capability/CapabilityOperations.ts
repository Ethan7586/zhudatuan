import { DomainError } from '../../foundation/domain/DomainError';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess } from '../../foundation/application/ModuleOperations';
import { bodyRecord, keysetRows, queryPage, textField } from '../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';

export function capabilityOperations(context: ModuleContext): ModuleOperations {
  const pool = context.service(DATABASE_POOL);
  return new ModuleOperations('capability', pool, context.service(AUDIT_SINK), {
    'capability.assignments.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const result = await database.query<{ id: string; scopeId: string; capabilityId: string; name: string; state: 'enabled' | 'disabled'; quota: number | null; effectiveAt: Date; expiresAt: Date | null; version: number }>(
        `select entitlement.id,entitlement.scope_id "scopeId",capability.id "capabilityId",capability.name,
        entitlement.state,entitlement.quota,entitlement.effective_at "effectiveAt",entitlement.expires_at "expiresAt",entitlement.version
        from capability.entitlement entitlement join capability.capability capability on capability.id=entitlement.capability_id
        where entitlement.scope_id=$1 and ($2::text is null or (capability.name,entitlement.id)>($2,$3))
        order by capability.name,entitlement.id limit $4`,
        [access.scope.id, page.sort, page.id, page.fetch]
      );
      const rows = result.rows.map((row) => Object.freeze({ ...row, effectiveAt: row.effectiveAt.toISOString(), expiresAt: row.expiresAt?.toISOString() ?? null }));
      return keysetRows(rows, page, 'name');
    },
    'capability.assignments.manage': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const result = await database.query<{ id: string; scopeId: string; capabilityId: string; state: 'enabled' | 'disabled'; quota: number | null; effectiveAt: Date; expiresAt: Date | null; version: number }>(
        `insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
        values($1,$2,$3,$4,$5,clock_timestamp(),$6,0) on conflict(id) do update set state=excluded.state,quota=excluded.quota,
        expires_at=excluded.expires_at,version=capability.entitlement.version+1
        where capability.entitlement.scope_id=$2 and ($7::bigint is null or capability.entitlement.version=$7)
        returning id,scope_id "scopeId",capability_id "capabilityId",state,quota,effective_at "effectiveAt",expires_at "expiresAt",version`,
        [request.input.path.assignmentid!, access.scope.id, textField(body, 'capability'), body.state === 'disabled' ? 'disabled' : 'enabled', body.quota ?? null, body.expiresAt ?? null, request.input.expectedVersion ?? null]
      );
      if (!result.rows[0]) throw new DomainError('VERSION_CONFLICT');
      const changed = result.rows[0]!;
      return { status: 200, body: { ...changed, effectiveAt: changed.effectiveAt.toISOString(), expiresAt: changed.expiresAt?.toISOString() ?? null } };
    },
  });
}
