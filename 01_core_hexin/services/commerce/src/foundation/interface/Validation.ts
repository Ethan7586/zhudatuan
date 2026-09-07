import type { OperationRequest } from '../application/OperationHandler';
import type { OperationResult } from '../application/OperationHandler';
import type { QueryResult, QueryResultRow } from 'pg';
import { CursorCodec, type CursorPosition } from './CursorCodec';

const cursorCodec = new CursorCodec();

export function bodyRecord(request: OperationRequest): Readonly<Record<string, unknown>> {
  const body = request.input.body;
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error('VALIDATION_FAILED');
  return body as Readonly<Record<string, unknown>>;
}

export function textField(body: Readonly<Record<string, unknown>>, field: string, maximum = 255): string {
  const value = body[field];
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > maximum) throw new Error(`VALIDATION_FAILED:${field}`);
  return value.trim();
}

export function secretField(body: Readonly<Record<string, unknown>>, field: string, maximum = 255): string {
  const value = body[field];
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) throw new Error(`VALIDATION_FAILED:${field}`);
  return value;
}

export function optionalText(body: Readonly<Record<string, unknown>>, field: string, maximum = 255): string | null {
  const value = body[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.trim().length > maximum) throw new Error(`VALIDATION_FAILED:${field}`);
  return value.trim();
}

export function integerField(body: Readonly<Record<string, unknown>>, field: string, minimum = 0): number {
  const value = body[field];
  if (!Number.isSafeInteger(value) || (value as number) < minimum) throw new Error(`VALIDATION_FAILED:${field}`);
  return value as number;
}

export function limit(request: OperationRequest, maximum = 100): number {
  const raw = request.input.query.limit;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = value === undefined ? 50 : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) throw new Error('QUERY_LIMIT_INVALID');
  return parsed;
}

export interface QueryPage {
  readonly limit: number;
  readonly fetch: number;
  readonly sort: string | null;
  readonly id: string | null;
}

export function queryPage(request: OperationRequest, maximum = 100): QueryPage {
  const requested = limit(request, maximum);
  const position = cursor(request);
  return Object.freeze({ limit: requested, fetch: requested + 1, sort: position?.sort ?? null, id: position?.id ?? null });
}

export function cursor(request: OperationRequest): CursorPosition | null {
  const raw = request.input.query.cursor;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === undefined ? null : cursorCodec.decode(value);
}

export function encodeCursor(position: CursorPosition): string {
  return cursorCodec.encode(position);
}

export function keysetResult<T extends QueryResultRow>(result: QueryResult<T>, page: QueryPage, sort: keyof T, id: keyof T = 'id' as keyof T): OperationResult {
  return keysetRows(result.rows,page,sort,id);
}

export function keysetRows<T extends QueryResultRow>(rows:readonly T[],page:QueryPage,sort:keyof T,id:keyof T='id' as keyof T):OperationResult {
  const more = rows.length > page.limit;
  const items = more ? rows.slice(0, page.limit) : rows;
  const last = items.at(-1);
  const nextCursor = more && last ? encodeCursor({ sort: cursorValue(last[sort]), id: cursorValue(last[id]) }) : undefined;
  return { status: 200, body: { items, count: items.length, ...(nextCursor === undefined ? {} : { nextCursor }) } };
}

function cursorValue(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  throw new Error('CURSOR_RESULT_POSITION_INVALID');
}
