import { createHash } from 'node:crypto';
import type { ImportState } from '../../public/ImportProcess';
import type { RuntimeImportCreated, RuntimeImportRecord, RuntimeImportView } from '../../public/ImportPort';

export interface RuntimeImportRow extends Record<string, unknown> {
  readonly id: string;
  readonly scope_id: string;
  readonly owner: string;
  readonly object_key: string;
  readonly file_hash: string;
  readonly state: string;
  readonly total_count?: number | string;
  readonly cursor_value?: number | string;
  readonly success_count?: number | string;
  readonly failure_count?: number | string;
  readonly created_at?: Date | string;
  readonly updated_at?: Date | string;
  readonly validation_summary?: Readonly<Record<string, unknown>>;
  readonly last_error?: string | null;
  readonly errors?: readonly Readonly<{ row_number: number; reason_code: string; field: string | null; detail: unknown }>[];
  readonly report_object_ref: string | null;
  readonly report_sha256: string | null;
  readonly report_size: number | string | null;
  readonly checkpoint?: Readonly<Record<string, unknown>>;
  readonly authorization_snapshot?: Readonly<Record<string, unknown>>;
}

export function runtimeImportRecord(row: RuntimeImportRow): RuntimeImportRecord {
  return Object.freeze({ body: runtimeImportView(row), report: runtimeImportReport(row) });
}

export function runtimeImportView(row: RuntimeImportRow): RuntimeImportView {
  return Object.freeze({
    ...runtimeImportCreated(row),
    validation_summary: Object.freeze({ ...(row.validation_summary ?? {}) }),
    last_error: row.last_error ?? null,
    errors: Object.freeze([...(row.errors ?? [])].map((failure) => Object.freeze({ row_number: Number(failure.row_number), reason_code: failure.reason_code, field: failure.field, detail: failure.detail }))),
  });
}

export function runtimeImportCreated(row: RuntimeImportRow): RuntimeImportCreated {
  return Object.freeze({
    id: row.id,
    state: runtimeImportState(row.state),
    total_count: Number(row.total_count ?? 0),
    cursor_value: Number(row.cursor_value ?? 0),
    success_count: Number(row.success_count ?? 0),
    failure_count: Number(row.failure_count ?? 0),
    created_at: timestamp(row.created_at),
    updated_at: timestamp(row.updated_at),
  });
}

export function runtimeImportDigest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function runtimeImportMetadata(checkpoint: Readonly<Record<string, unknown>> | undefined): Readonly<Record<string, unknown>> {
  const value = checkpoint?.metadata;
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? Object.freeze({ ...(value as Readonly<Record<string, unknown>>) }) : Object.freeze({});
}

function runtimeImportReport(row: RuntimeImportRow): RuntimeImportRecord['report'] {
  if (row.report_object_ref === null && row.report_sha256 === null && row.report_size === null) return null;
  const size = Number(row.report_size);
  if (typeof row.report_object_ref !== 'string' || typeof row.report_sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(row.report_sha256) || !Number.isSafeInteger(size) || size < 0) throw new Error('RUNTIME_IMPORT_REPORT_INVALID');
  return Object.freeze({ reference: row.report_object_ref, sha256: row.report_sha256, size });
}

function runtimeImportState(value: string): ImportState {
  if (value === 'preflight' || value === 'scanning' || value === 'rejected') return value === 'rejected' ? 'failed' : 'validating';
  if (value === 'succeeded') return 'completed';
  return value as ImportState;
}

function timestamp(value: Date | string | undefined): string {
  if (value === undefined) throw new Error('RUNTIME_IMPORT_TIME_INVALID');
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error('RUNTIME_IMPORT_TIME_INVALID');
  return parsed.toISOString();
}
