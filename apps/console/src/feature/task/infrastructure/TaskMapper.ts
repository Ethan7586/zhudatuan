import { deepFreeze } from '../../../shared/model/Immutable';
import type { ImportKind, ImportState, ImportTask, ImportValidation } from '../model/ImportTask';
import { CatalogImportDtoSchema, MemberImportDtoSchema, VoucherImportDtoSchema, type ImportTaskDto } from './TaskSchema';

export class TaskMapper {
  task(kind: ImportKind, value: unknown): ImportTask {
    const dto = (kind === 'member' ? MemberImportDtoSchema : kind === 'catalog' ? CatalogImportDtoSchema : VoucherImportDtoSchema).parse(value) as ImportTaskDto;
    return deepFreeze({
      id: dto.id,
      kind,
      state: importState(dto.state),
      totalCount: dto.total_count,
      cursor: dto.cursor_value,
      successCount: dto.success_count,
      failureCount: dto.failure_count,
      validation: validation(dto.validation_summary),
      lastError: dto.last_error,
      createdAt: dto.created_at,
      updatedAt: dto.updated_at,
      issues: dto.errors.map((issue) => ({ row: issue.row_number, code: issue.reason_code, field: issue.field, detail: detail(issue.detail) })),
      ...(dto.report === undefined ? {} : { report: { sha256: dto.report.sha256, size: dto.report.size, download: dto.report.download } }),
    });
  }
}

const states: readonly ImportState[] = Object.freeze(['uploaded', 'validating', 'ready', 'running', 'reporting', 'completed', 'failed', 'cancelled']);
function importState(value: string): ImportState {
  const state = states.find((candidate) => candidate === value);
  if (state === undefined) throw new Error('IMPORT_STATE_INVALID');
  return state;
}
function validation(value: unknown): ImportValidation {
  if (!record(value)) return Object.freeze({});
  const format = text(value.format);
  const rows = count(value.rows);
  const columns = Array.isArray(value.columns) ? value.columns.filter((item): item is string => typeof item === 'string').slice(0, 100) : undefined;
  const shardSize = count(value.shardSize);
  const processed = count(value.processed);
  const errors = count(value.errors);
  const encryptedStaging = typeof value.encryptedStaging === 'boolean' ? value.encryptedStaging : undefined;
  const code = text(value.code);
  return Object.freeze({
    ...(format === undefined ? {} : { format }),
    ...(rows === undefined ? {} : { rows }),
    ...(columns === undefined ? {} : { columns: Object.freeze(columns) }),
    ...(shardSize === undefined ? {} : { shardSize }),
    ...(processed === undefined ? {} : { processed }),
    ...(errors === undefined ? {} : { errors }),
    ...(encryptedStaging === undefined ? {} : { encryptedStaging }),
    ...(code === undefined ? {} : { code }),
  });
}
function detail(value: unknown): string {
  if (value === null) return '—';
  if (typeof value === 'string') return value.slice(0, 500);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value).slice(0, 500);
  } catch {
    return '请下载结果报告查看详情';
  }
}
function count(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}
function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.length <= 128 ? value : undefined;
}
function record(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
