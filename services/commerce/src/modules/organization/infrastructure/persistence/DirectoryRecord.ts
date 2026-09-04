import { DirectoryConnection, type DirectoryConnectionValue } from '../../domain/model/DirectoryConnection';
import { SyncRun, type SyncMode } from '../../domain/model/SyncRun';

export interface ConnectionRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly organization_id: string;
  readonly provider_instance_id: string;
  readonly provider_type: 'wecomcorp' | 'wecomsuite';
  readonly secret_ref: string;
  readonly cursor_ciphertext: string | null;
  readonly successful_version: number;
  readonly status: DirectoryConnectionValue['status'];
  readonly version: number;
}
export interface RunRow {
  readonly id: string;
  readonly connection_id: string;
  readonly provider_run_id: string;
  readonly mode: SyncMode;
  readonly state: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  readonly cursor_ciphertext: string | null;
  readonly read_count: number;
  readonly applied_count: number;
  readonly conflict_count: number;
  readonly ignored_count: number;
}
export interface ConnectionSummaryRow {
  readonly id: string;
  readonly organization_id: string;
  readonly type: 'wecomcorp' | 'wecomsuite';
  readonly status: DirectoryConnectionValue['status'];
  readonly successful_version: number;
  readonly version: number;
  readonly updated_at: Date;
  readonly last_success_at: Date | null;
}
export interface RunSummaryRow {
  readonly id: string;
  readonly mode: SyncMode;
  readonly state: RunRow['state'];
  readonly read_count: number;
  readonly applied_count: number;
  readonly conflict_count: number;
  readonly ignored_count: number;
  readonly watermark: Date | null;
  readonly started_at: Date | null;
  readonly completed_at: Date | null;
  readonly created_at: Date;
}

export function mapConnection(row: ConnectionRow): DirectoryConnection {
  if (!['wecomcorp', 'wecomsuite'].includes(row.provider_type)) throw new Error('DIRECTORY_PROVIDER_UNAVAILABLE');
  return new DirectoryConnection({
    id: row.id,
    tenantid: row.tenant_id,
    organizationid: row.organization_id,
    providerid: row.provider_instance_id,
    providertype: row.provider_type,
    secretref: row.secret_ref,
    cursor: row.cursor_ciphertext,
    successfulversion: Number(row.successful_version),
    status: row.status,
    version: Number(row.version),
  });
}
export function mapRun(row: RunRow): SyncRun {
  return new SyncRun({
    id: row.id,
    connectionid: row.connection_id,
    providerrunid: row.provider_run_id,
    mode: row.mode,
    state: row.state,
    cursor: row.cursor_ciphertext,
    read: Number(row.read_count),
    applied: Number(row.applied_count),
    conflicts: Number(row.conflict_count),
    ignored: Number(row.ignored_count),
  });
}

export function runSummary(row: RunSummaryRow): Readonly<Record<string, unknown>> {
  return Object.freeze({
    ...row,
    read_count: Number(row.read_count),
    applied_count: Number(row.applied_count),
    conflict_count: Number(row.conflict_count),
    ignored_count: Number(row.ignored_count),
    watermark: row.watermark?.toISOString() ?? null,
    started_at: row.started_at?.toISOString() ?? null,
    completed_at: row.completed_at?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
  });
}
