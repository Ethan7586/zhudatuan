import { DomainError } from '../../foundation/domain/DomainError';
import type { OperationResult } from '../../foundation/application/OperationRequest';
import type { QueryResult, QueryResultRow } from 'pg';

export function rowResult<T extends QueryResultRow>(result: QueryResult<T>, status = 200): OperationResult {
  const row = result.rows[0];
  if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
  return { status, body: row, ...(Reflect.has(row, 'version') ? { headers: { etag: `"${String(Reflect.get(row, 'version'))}"` } } : {}) };
}

export function pageResult<T extends QueryResultRow>(result: QueryResult<T>): OperationResult {
  return { status: 200, body: { items: result.rows, count: result.rows.length } };
}
