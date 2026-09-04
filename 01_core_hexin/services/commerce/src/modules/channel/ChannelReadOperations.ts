import type { OperationId } from '@shop/contract';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess, type OperationActions } from '../../foundation/application/ModuleOperations';
import { keysetResult, queryPage } from '../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';

export const CHANNEL_OPERATOR_READ_OPERATION_IDS = Object.freeze([
  'channel.connections.read',
  'channel.syncruns.read',
  'channel.operations.read',
] as const satisfies readonly OperationId[]);

export function channelOperatorReadActions(): OperationActions {
  return {
    'channel.connections.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(`select connection.id,connection.provider,connection.scope_id,connection.status,
        connection.contract_version,connection.region,connection.connection_timeout_ms,connection.response_timeout_ms,
        connection.total_deadline_ms,connection.max_concurrency,connection.requests_per_second,connection.max_attempts,
        connection.failure_threshold,connection.recovery_ms,connection.version,connection.created_at,connection.updated_at,
        connection.secret_ref is not null has_secret from channel.connection connection
        where connection.scope_id=$1 and ($2::text is null or connection.id>$2) order by connection.id limit $3`,
      [access.scope.id, page.id, page.fetch]);
      const ids = result.rows.map((row) => String(row.id));
      const summaries = ids.length === 0 ? [] : (await database.query(`select installation.id,
        installation.manifest->'capabilities' capabilities,health.state health_state,health.latency_ms health_latency_ms,
        health.reason health_reason,health.checked_at from extension.installation installation left join lateral(
          select state,latency_ms,reason,checked_at from extension.health where installation_id=installation.id
          order by checked_at desc limit 1) health on true where installation.id=any($1::text[])`, [ids])).rows;
      const byId = new Map(summaries.map((summary) => [String(summary.id), summary]));
      result.rows = result.rows.map((row) => ({ ...row, ...byId.get(String(row.id)) }));
      return keysetResult(result, page, 'id');
    },
    'channel.syncruns.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(`select run.*,coalesce(run.started_at,'infinity')::text cursor_sort
        from channel.syncrun run join channel.connection connection on connection.id=run.connection_id where connection.scope_id=$1
        and ($2::timestamptz is null or (coalesce(run.started_at,'infinity'),run.id)<($2::timestamptz,$3))
        order by coalesce(run.started_at,'infinity') desc,run.id desc limit $4`,
      [access.scope.id, page.sort, page.id, page.fetch]);
      return keysetResult(result, page, 'cursor_sort');
    },
    'channel.operations.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(`select id,provider,kind,internal_reference,external_reference,state,response,created_at,updated_at
        from channel.provideroperation where scope_id=$1 and ($2::timestamptz is null or (updated_at,id)<($2::timestamptz,$3))
        order by updated_at desc,id desc limit $4`, [access.scope.id, page.sort, page.id, page.fetch]);
      return keysetResult(result, page, 'updated_at');
    },
  };
}

export function channelOperatorReadOperations(context: ModuleContext): ModuleOperations {
  return new ModuleOperations('channel', context.container.get(DATABASE_POOL), context.container.get(AUDIT_SINK),
    channelOperatorReadActions(), CHANNEL_OPERATOR_READ_OPERATION_IDS);
}
