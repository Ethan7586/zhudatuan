import type { TelemetryScope } from '@shop/telemetry';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../application/AuditSink';
import { ModuleOperations, requireAccess, type OperationDatabase } from '../application/ModuleOperations';
import { bodyRecord, limit, optionalText, textField } from '../interface/Validation';
import { DATABASE_POOL } from '../persistence/Pool';
import { TELEMETRY } from './Telemetry';

const SURFACES = new Set(['console', 'storefront', 'auth', 'miniapp', 'store', 'supplier']);

export function clientErrorOperations(context: ModuleContext): ModuleOperations {
  const telemetry = context.container.get(TELEMETRY);
  return new ModuleOperations('observability', context.container.get(DATABASE_POOL), context.container.get(AUDIT_SINK), {
    'observability.clienterrors.create': async (request, database) => {
      const access = requireAccess(request); const body = bodyRecord(request); const surface = textField(body, 'surface', 32);
      if (!SURFACES.has(surface)) throw new Error('CLIENT_ERROR_SURFACE_INVALID');
      const scope = await organizationScope(database, access.membership.id);
      const recorded = telemetry.clientErrors.record({ scope, surface, route:textField(body, 'route', 500), message:textField(body, 'message', 500),
        stack:optionalText(body, 'stack', 8_000), componentStack:optionalText(body, 'componentStack', 8_000), traceId:access.trace,
        actorId:access.actor.id, membershipId:access.membership.id });
      return { status:202, body:{ faultCode:recorded.faultCode, fingerprint:recorded.fingerprint, occurrences:recorded.occurrences } };
    },
    'observability.clienterrors.read': async (request) => {
      const access = requireAccess(request); const items = telemetry.clientErrors.list(access.scope, limit(request, 200));
      return { status:200, body:{ items, count:items.length } };
    },
  });
}

async function organizationScope(database: OperationDatabase, membership: string): Promise<TelemetryScope> {
  const result = await database.query<{ scope: TelemetryScope }>(`select access.scope_object(organization_id) scope
    from access.membership where id=$1 and status='active'`, [membership]);
  const scope = result.rows[0]?.scope;
  if (!scope) throw new Error('MEMBERSHIP_INACTIVE');
  return scope;
}
