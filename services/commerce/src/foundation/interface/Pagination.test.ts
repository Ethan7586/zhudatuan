import type { QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import { CursorCodec } from './CursorCodec';
import { keysetResult, type QueryPage } from './Validation';

const page: QueryPage = Object.freeze({ limit: 2, fetch: 3, sort: null, id: null });

describe('keysetResult', () => {
  it('returns a cursor only when one fetched lookahead row proves another page', () => {
    const result = keysetResult(
      query([
        { id: 'order:3', created_at: new Date('2026-08-21T03:00:00Z') },
        { id: 'order:2', created_at: new Date('2026-08-21T02:00:00Z') },
        { id: 'order:1', created_at: new Date('2026-08-21T01:00:00Z') },
      ]),
      page,
      'created_at'
    );
    const body = result.body as { items: readonly unknown[]; count: number; nextCursor: string };
    expect(body.items).toHaveLength(2);
    expect(body.count).toBe(2);
    expect(new CursorCodec().decode(body.nextCursor)).toEqual({ sort: '2026-08-21T02:00:00.000Z', id: 'order:2' });
  });

  it('does not emit a speculative cursor for the terminal page', () => {
    expect(keysetResult(query([{ id: 'order:1', created_at: '2026-08-21T01:00:00Z' }]), page, 'created_at').body).toEqual({ items: [{ id: 'order:1', created_at: '2026-08-21T01:00:00Z' }], count: 1 });
  });
});

function query<T extends Record<string, unknown>>(rows: T[]): QueryResult<T> {
  return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] };
}
