import { ProductionApiError } from './productionApi.error';

export type JsonRecord = Record<string, unknown>;

export function record(value: unknown, label: string): JsonRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid(label);
  return value as JsonRecord;
}

export function records(value: unknown, label: string): JsonRecord[] {
  if (!Array.isArray(value)) invalid(label);
  return value.map((item, index) => record(item, `${label}[${index}]`));
}

export function pageItems(value: unknown, label: string): JsonRecord[] {
  return records(record(value, label).items, `${label}.items`);
}

export function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) invalid(label);
  return value;
}

export function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function integer(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) invalid(label);
  return value;
}

export function nonNegativeInteger(value: unknown, label: string): number {
  const result = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : integer(value, label);
  if (!Number.isSafeInteger(result)) invalid(label);
  if (result < 0) invalid(label);
  return result;
}

export function version(value: unknown, label: string): number {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  invalid(label);
}

export function boolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function nextCursor(value: unknown): string | null {
  const cursor = record(value, 'page').nextCursor;
  return typeof cursor === 'string' && cursor.length > 0 ? cursor : null;
}

export function asDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const result = text(value, 'date');
  if (!Number.isFinite(Date.parse(result))) invalid('date');
  return result;
}

export function invalid(label: string): never {
  throw new ProductionApiError(`服务响应缺少有效字段：${label}`, 502, 'CONTRACT_RESPONSE_INVALID');
}
