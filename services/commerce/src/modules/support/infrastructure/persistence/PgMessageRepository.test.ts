import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { withWriteTransaction } from '../../../../test/TransactionFixture';
import { PgMessageRepository } from './PgMessageRepository';

describe('PgMessageRepository', () => {
  it('writes the append-only message before deterministically linking clean evidence', async () => {
    const calls: string[] = [];
    const query = vi.fn(async (sql: string) => {
      calls.push(sql);
      if (sql.includes('insert into support.message(')) return result([{ id: 'message:one', client_message_id: 'client:0001', conversation_id: 'conversation:one', author_type: 'agent', author_id: 'actor:one', body_hash: 'a'.repeat(64), sequence: 3, version: 1, created_at: '2026-09-02T00:00:00.000Z' }]);
      return result([]);
    });
    const stored = await withWriteTransaction(query, (context) => new PgMessageRepository().append(context, { scope: 'mall:one', conversation: 'conversation:one', authorType: 'agent', authorId: 'actor:one', sequence: 3, message: { id: 'message:one', clientMessageId: 'client:0001', ciphertext: 'encrypted-message', fingerprint: 'a'.repeat(64), keyVersion: 'v1', body: '不会进入 SQL' }, attachments: ['evidence:two', 'evidence:one'] }));
    expect(stored).toMatchObject({ id: 'message:one', sequence: 3, version: 1 });
    expect(calls[0]).toContain('insert into support.message');
    expect(calls[1]).toContain('insert into support.messageevidence');
    expect(calls[1]).toContain('order by evidence.id');
    expect(JSON.stringify(query.mock.calls)).not.toContain('不会进入 SQL');
  });

  it('finds idempotent replay by conversation, author and client message id', async () => {
    const query = vi.fn(async () => result([{ id: 'message:one', client_message_id: 'client:0001', conversation_id: 'conversation:one', author_type: 'member', author_id: 'actor:one', body_hash: 'b'.repeat(64), sequence: 8, version: 1, created_at: '2026-09-02T00:00:00.000Z' }]));
    await expect(withWriteTransaction(query, (context) => new PgMessageRepository().existing(context, 'conversation:one', 'actor:one', 'client:0001'))).resolves.toMatchObject({ id: 'message:one', sequence: 8 });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('client_message_id=$3'), ['conversation:one', 'actor:one', 'client:0001']);
  });
});

function result(rows: readonly unknown[]): QueryResult<any> { return { rows: [...rows], rowCount: rows.length, command: '', oid: 0, fields: [] } as QueryResult<any>; }
