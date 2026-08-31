import { createHash } from 'node:crypto';
import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { DatabasePool } from '../persistence/Pool';
import { consumeActionProof, PgActionProofVerifier } from './ActionProof';

describe('financial action proof', () => {
  it('hashes the bearer and sends every binding, including requestHash, through the transaction client', async () => {
    const query = vi.fn(async () => ({ rows: [{ consumed: true }], rowCount: 1 }) as unknown as QueryResult<{ consumed: boolean }>);
    const pool = { query } as unknown as DatabasePool;
    const proof = 'a'.repeat(64);
    const binding = {
      proof,
      actor: 'actor:one',
      session: 'session:one',
      membership: 'membership:one',
      scope: 'organization:one',
      operation: 'finance.settlements.decide',
      resource: 'settlement:one',
      idempotency: 'decision:one',
      expectedVersion: 7,
      requestHash: 'b'.repeat(64),
    } as const;

    await expect(consumeActionProof(pool, binding)).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('access.consume_action_proof'), [
      createHash('sha256').update(proof).digest('hex'),
      'actor:one',
      'session:one',
      'membership:one',
      'organization:one',
      'finance.settlements.decide',
      'settlement:one',
      'decision:one',
      7,
      'b'.repeat(64),
    ]);
  });

  it('authorization validation is local and malformed values never touch the database', async () => {
    const query = vi.fn();
    const pool = { query } as unknown as DatabasePool;
    expect(new PgActionProofVerifier(pool).validate('not a proof')).toBe(false);
    await expect(
      consumeActionProof(pool, {
        proof: 'not a proof',
        actor: 'actor',
        session: 'session',
        membership: 'membership',
        scope: 'scope',
        operation: 'finance.settlements.decide',
        resource: 'settlement',
        idempotency: 'decision',
        expectedVersion: 1,
        requestHash: 'b'.repeat(64),
      })
    ).resolves.toBe(false);
    expect(query).not.toHaveBeenCalled();
  });
});
