import { DomainError } from '../domain/DomainError';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import type { OperationResult } from '../application/OperationHandler';
import type { QueryResult, QueryResultRow } from 'pg';
import { CursorCodec, type CursorPosition } from './CursorCodec';

const cursorCodec = new CursorCodec();

export interface OperationWireInput {
  readonly body?: unknown;
  readonly query?: Readonly<Record<string, unknown>>;
}

export function bodyRecord(input: OperationWireInput): Readonly<Record<string, unknown>> {
  const body = input.body;
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new DomainError('VALIDATION_FAILED');
  return body as Readonly<Record<string, unknown>>;
}

export function textField(body: Readonly<Record<string, unknown>>, field: string, maximum = 255): string {
  const value = body[field];
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > maximum) throw new DomainError('VALIDATION_FAILED', { field: field });
  return value.trim();
}

export function optionalText(body: Readonly<Record<string, unknown>>, field: string, maximum = 255): string | null {
  const value = body[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.trim().length > maximum) throw new DomainError('VALIDATION_FAILED', { field: field });
  return value.trim();
}

export function nullableText(body: Readonly<Record<string, unknown>>, field: string, maximum = 255): string | null {
  if (body[field] === '') return null;
  const value = optionalText(body, field, maximum);
  if (value === '') throw new DomainError('VALIDATION_FAILED', { field });
  return value;
}

export function integerField(body: Readonly<Record<string, unknown>>, field: string, minimum = 0): number {
  const value = body[field];
  if (!Number.isSafeInteger(value) || (value as number) < minimum) throw new DomainError('VALIDATION_FAILED', { field: field });
  return value as number;
}

export function limit(input: OperationWireInput, maximum: number = RUNTIME_LIMITS.sql.maximumRows): number {
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > RUNTIME_LIMITS.sql.maximumRows) throw new Error('QUERY_LIMIT_MAXIMUM_INVALID');
  const raw = input.query?.limit;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = value === undefined ? RUNTIME_LIMITS.sql.defaultRows : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) throw new Error('QUERY_LIMIT_INVALID');
  return parsed;
}

export interface QueryPage {
  readonly limit: number;
  readonly fetch: number;
  readonly sort: string | null;
  readonly id: string | null;
}

export function queryPage(input: OperationWireInput, maximum: number = RUNTIME_LIMITS.sql.maximumRows): QueryPage {
  const requested = limit(input, maximum);
  const position = cursor(input);
  return Object.freeze({ limit: requested, fetch: requested + 1, sort: position?.sort ?? null, id: position?.id ?? null });
}

export function cursor(input: OperationWireInput): CursorPosition | null {
  const raw = input.query?.cursor;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new Error('QUERY_CURSOR_INVALID');
  return cursorCodec.decode(value);
}

export function encodeCursor(position: CursorPosition): string {
  return cursorCodec.encode(position);
}

export function keysetResult<T extends QueryResultRow>(result: QueryResult<T>, page: QueryPage, sort: keyof T, id: keyof T = 'id' as keyof T): OperationResult {
  return keysetRows(result.rows, page, sort, id);
}

export function keysetRows<T extends QueryResultRow>(rows: readonly T[], page: QueryPage, sort: keyof T, id: keyof T = 'id' as keyof T): OperationResult {
  return { status: 200, body: keysetPage(rows, page, sort, id) };
}

export function keysetPage<T extends object>(rows: readonly T[], page: QueryPage, sort: keyof T, id: keyof T = 'id' as keyof T): Readonly<{ items: readonly T[]; count: number; nextCursor?: string }> {
  const more = rows.length > page.limit;
  const items = more ? rows.slice(0, page.limit) : rows;
  const last = items.at(-1);
  const nextCursor = more && last ? encodeCursor({ sort: cursorValue(last[sort]), id: cursorValue(last[id]) }) : undefined;
  return Object.freeze({ items: Object.freeze([...items]), count: items.length, ...(nextCursor === undefined ? {} : { nextCursor }) });
}

function cursorValue(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  throw new Error('CURSOR_RESULT_POSITION_INVALID');
}
