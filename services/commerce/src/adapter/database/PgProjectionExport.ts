import { randomUUID } from 'node:crypto';
import { requireAccess } from '../../foundation/application/OperationAccess';
import type { OperationRequest } from '../../foundation/application/OperationHandler';
import type { SqlExecutor } from './PgTransactionAccess';

export type ProjectionExportReport = 'orders' | 'finance.statement';

export async function requestProjectionExport(request: OperationRequest, database: SqlExecutor, report: ProjectionExportReport, filter: Readonly<Record<string, unknown>>) {
  const serialized = JSON.stringify(filter);
  if (serialized.length > 16_384) throw new Error('REPORT_FILTER_TOO_LARGE');
  const access = requireAccess(request);
  const id = `export:${randomUUID()}`;
  const domain = request.type.split('.')[0]!;
  const event = `event:${randomUUID()}`;
  const authorization = { actor: access.actor.id, membership: access.membership.id, scope: access.scope.id, trace: access.trace };
  const result = await database.query<{ occurred_at: Date }>(
    `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,
    scope_id,payload,trace_id,occurred_at,available_at) values($1,$2,1,'export',$3,$4,$5::jsonb,$6,clock_timestamp(),clock_timestamp())
    returning occurred_at`,
    [event, `${domain}.export.requested`, id, access.scope.id, JSON.stringify({ export: id, report, filter, authorization }), access.trace]
  );
  const occurredAt = result.rows[0]?.occurred_at;
  if (!occurredAt) throw new Error('EXPORT_REQUEST_EVENT_FAILED');
  return Object.freeze({
    id,
    scope: access.scope.id,
    report,
    filter,
    state: 'queued' as const,
    cursor: null,
    recordCount: 0,
    objectReference: null,
    objectHash: null,
    objectSize: null,
    scanState: null,
    expiresAt: null,
    createdAt: occurredAt.toISOString(),
    generatedAt: null,
  });
}
