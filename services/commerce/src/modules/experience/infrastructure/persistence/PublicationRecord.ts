import { Release, type ReleaseState } from '../../domain/model/Release';

export interface PublicationRow {
  readonly application_id: string;
  readonly configuration: unknown;
  readonly configuration_hash: string;
  readonly effective_at: string;
  readonly pool_id: string;
  readonly release_id: string;
  readonly state: string;
  readonly version_id: string;
}
export interface ReleaseRow {
  readonly id: string;
  readonly application_id: string;
  readonly version_id: string;
  readonly pool_id: string;
  readonly state: ReleaseState;
  readonly effective_at: Date | string;
  readonly retired_at: Date | string | null;
  readonly failed_at: Date | string | null;
  readonly failure_code: string | null;
  readonly published_by: string;
}
export interface ReleaseOwnerRow extends ReleaseRow {
  readonly mall_id: string;
}
export interface ApplicationOwnerRow {
  readonly id: string;
  readonly mall_id: string;
  readonly code: string;
  readonly public_slug: string;
  readonly name: string;
  readonly status: 'draft' | 'active' | 'disabled';
  readonly is_primary: boolean;
  readonly head_version_id: string | null;
  readonly version: unknown;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
}

export function restoreRelease(row: ReleaseRow): Release {
  return Release.restore({
    id: row.id,
    application: row.application_id,
    version: row.version_id,
    pool: row.pool_id,
    state: row.state,
    effectiveAt: iso(row.effective_at),
    retiredAt: nullableIso(row.retired_at),
    failedAt: nullableIso(row.failed_at),
    failureCode: row.failure_code,
    actor: row.published_by,
  });
}
function iso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}
function nullableIso(value: Date | string | null): string | null {
  return value === null ? null : iso(value);
}
