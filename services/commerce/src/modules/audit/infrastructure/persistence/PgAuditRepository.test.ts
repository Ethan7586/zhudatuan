import { describe, expect, it, vi } from 'vitest';
import { result, withWriteTransaction } from '../../../../test/TransactionFixture';
import { PgAuditRepository } from './PgAuditRepository';

describe('PgAuditRepository archive immutability', () => {
  it('records immutable archive mappings without deleting source evidence', async () => {
    const statements: string[] = [];
    const query = vi.fn(async (text: string) => {
      statements.push(text.replace(/\s+/g, ' ').trim());
      if (text.includes('select 1 from audit.archiveref')) return result([{ exists: 1 }]);
      if (text.includes('select count(*)::integer count')) return result([{ count: 2, exact: true }]);
      return result([]);
    });
    await withWriteTransaction(query, (context) =>
      new PgAuditRepository().completeArchive(
        context,
        {
          scope: 'scope:1',
          start: '2026-01-01T00:00:00.000000Z',
          end: '2026-01-02T00:00:00.000000Z',
          firstHash: 'a'.repeat(64),
          lastHash: 'b'.repeat(64),
          rows: [{ id: 'audit:1' }, { id: 'access:1' }],
          recordIds: ['audit:1'],
          accessIds: ['access:1'],
          archiveYears: 7,
        },
        {
          reference: 'object:audit',
          sha256: 'c'.repeat(64),
          size: 1024,
          keyVersion: 'kms:v1',
          plaintextHash: 'd'.repeat(64),
          indexHash: 'e'.repeat(64),
          lockedUntil: '2033-01-02T00:00:00.000Z',
          expiresAt: '2033-01-02T00:00:00.000Z',
          entries: [
            { kind: 'command', id: 'audit:1', recordHash: 'a'.repeat(64) },
            { kind: 'access', id: 'access:1', recordHash: 'b'.repeat(64) },
          ],
        }
      )
    );

    expect(statements.some((statement) => statement.startsWith('insert into audit.archiveitem'))).toBe(true);
    expect(statements.some((statement) => /\b(?:delete|update)\s+(?:from\s+)?audit\.(?:record|accessrecord)\b/i.test(statement))).toBe(false);
  });
});
