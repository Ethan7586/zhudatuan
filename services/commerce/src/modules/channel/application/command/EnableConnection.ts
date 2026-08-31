import { DomainError } from '../../../../foundation/domain/DomainError';
import type { OperationActions, OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { requireAccess, rowResult } from '../../../../foundation/application/ModuleOperations';
import type { DisableExtensionPort, EnableExtensionPort } from '../../../extension/public/index';
import { Connection, type ConnectionState } from '../../domain/model/Connection';

interface ConnectionRow {
  readonly id: string;
  readonly provider: string;
  readonly scope_id: string;
  readonly status: ConnectionState;
  readonly region: string;
  readonly connection_timeout_ms: number;
  readonly response_timeout_ms: number;
  readonly total_deadline_ms: number;
  readonly max_concurrency: number;
  readonly requests_per_second: number;
  readonly max_attempts: number;
  readonly failure_threshold: number;
  readonly recovery_ms: number;
  readonly version: number;
}

export function enableConnectionOperations(enable: EnableExtensionPort, disable: DisableExtensionPort): OperationActions {
  return {
    'channel.connections.test': async (request, database) => {
      const access = requireAccess(request);
      const id = request.input.path.connectionid!;
      const row = await lock(database, id, access.scope.id);
      connection(row).requireTransition('testing');
      await enable.test(database, id, access.scope.id, access.actor.id, access.trace);
      const result = await update(database, row, 'testing');
      return { status: 202, body: { ...result.rows[0], state: 'testing' } };
    },
    'channel.connections.enable': async (request, database) => {
      const access = requireAccess(request);
      const id = request.input.path.connectionid!;
      const row = await lock(database, id, access.scope.id);
      connection(row).requireTransition('enabled');
      const displaced = await enable.enable(database, id, access.scope.id, access.actor.id, access.trace);
      if (displaced)
        await database.query(
          `update channel.connection set status='disabled',version=version+1,updated_at=clock_timestamp()
        where id=$1 and scope_id=$2 and status='enabled'`,
          [displaced, access.scope.id]
        );
      return rowResult(await update(database, row, 'enabled'));
    },
    'channel.connections.disable': async (request, database) => {
      const access = requireAccess(request);
      const id = request.input.path.connectionid!;
      const row = await lock(database, id, access.scope.id);
      connection(row).requireTransition('disabled');
      const provider = await disable.execute(database, id, access.scope.id, access.actor.id, access.trace);
      const result = await update(database, row, 'disabled');
      return rowResult({ ...result, rows: result.rows.map((item) => ({ ...item, provider })) });
    },
  };
}

async function lock(database: OperationDatabase, id: string, scope: string): Promise<ConnectionRow> {
  const result = await database.query<ConnectionRow>(
    `select id,provider,scope_id,status,region,connection_timeout_ms,response_timeout_ms,
    total_deadline_ms,max_concurrency,requests_per_second,max_attempts,failure_threshold,recovery_ms,version
    from channel.connection where id=$1 and scope_id=$2 for update`,
    [id, scope]
  );
  const row = result.rows[0];
  if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
  return row;
}
function update(database: OperationDatabase, row: ConnectionRow, state: ConnectionState) {
  return database.query<ConnectionRow>(
    `update channel.connection set status=$3,version=version+1,updated_at=clock_timestamp()
    where id=$1 and scope_id=$2 and version=$4 returning id,provider,scope_id,status,region,connection_timeout_ms,
    response_timeout_ms,total_deadline_ms,max_concurrency,requests_per_second,max_attempts,failure_threshold,recovery_ms,version`,
    [row.id, row.scope_id, state, row.version]
  );
}
function connection(row: ConnectionRow): Connection {
  return new Connection(
    row.id,
    row.provider,
    row.scope_id,
    row.status,
    row.region,
    {
      connectionTimeoutMs: row.connection_timeout_ms,
      responseTimeoutMs: row.response_timeout_ms,
      totalDeadlineMs: row.total_deadline_ms,
      maxConcurrency: row.max_concurrency,
      requestsPerSecond: Number(row.requests_per_second),
      maxAttempts: row.max_attempts,
      failureThreshold: row.failure_threshold,
      recoveryMs: row.recovery_ms,
    },
    row.version
  );
}
