import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import { MAX_LOGIN_FAILURES, recordLoginFailure } from './IdentitySecurity';

describe('identity login throttling', () => {
  it('uses the Owner-approved ten-attempt threshold', async () => {
    const query = vi.fn(async () => ({ rows: [] }) as unknown as QueryResult);
    const database = { query } as unknown as OperationDatabase;

    await recordLoginFailure(database, [['subject-hash', 'client-hash']]);

    expect(MAX_LOGIN_FAILURES).toBe(10);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('>=$3'),
      ['subject-hash', 'client-hash', 10],
    );
  });
});
