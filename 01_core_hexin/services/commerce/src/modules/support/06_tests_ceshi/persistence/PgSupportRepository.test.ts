import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { PgSupportRepository } from '../../04_adapters_shixian/persistence/PgSupportRepository';

describe('PgSupportRepository', () => {
  it('gives history projection parameters an explicit SQL type', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new PgSupportRepository({ query } as unknown as OperationDatabase, {} as never);

    await repository.history('case:one', 'mall:one', 'opened', 'actor:one', { priority: 'normal' });

    expect(query).toHaveBeenCalledWith(expect.stringContaining('$2::text'), [
      'case:one', 'mall:one', 'opened', 'actor:one', JSON.stringify({ priority: 'normal' }),
    ]);
  });

  it('gives polymorphic message outbox payload parameters explicit SQL types', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: 'message:one', author_type: 'agent', author_id: 'actor:one',
        created_at: '2026-09-14T14:30:00.000Z' }] })
      .mockResolvedValueOnce({ rows: [] });
    const repository = new PgSupportRepository({ query } as unknown as OperationDatabase, {} as never);

    await repository.message('case:one', 'conversation:one', 'mall:one', 'agent', 'actor:one', 'public', {
      id: 'message:one', ciphertext: 'ciphertext', fingerprint: 'a'.repeat(64), keyVersion: 'v1',
    });

    const outboxSql = String(query.mock.calls[1]?.[0]);
    expect(outboxSql).toContain("jsonb_build_object('ticket',$4::text");
    expect(outboxSql).toContain("'conversation',$2::text");
    expect(outboxSql).toContain("'message',$5::text");
    expect(outboxSql).toContain("'authorType',$6::text");
  });

  it('stores internal notes without creating a requester notification', async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [{ id: 'message:note', author_type: 'agent', author_id: 'actor:one',
      created_at: '2026-09-14T14:31:00.000Z' }] });
    const repository = new PgSupportRepository({ query } as unknown as OperationDatabase, {} as never);

    await repository.message('case:one', 'conversation:one', 'mall:one', 'agent', 'actor:one', 'internal', {
      id: 'message:note', ciphertext: 'ciphertext', fingerprint: 'b'.repeat(64), keyVersion: 'v1',
    });

    expect(query).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith(expect.stringContaining('visibility'), expect.arrayContaining(['internal']));
  });
});
