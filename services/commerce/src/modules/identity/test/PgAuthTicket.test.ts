import { createHash } from 'node:crypto';
import type { QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import { PgAuthTicket } from '../infrastructure/persistence/PgAuthTicket';
import { withWriteTransaction } from '../../../test/TransactionFixture';

describe('PgAuthTicket exchange', () => {
  it('binds the ticket to the current session and consumes it while rotating the session token atomically', async () => {
    const currentSessionToken = 'current-session-token';
    const nextSessionToken = 'next-session-token';
    const sessionExpiresAt = new Date('2026-08-28T16:00:00.000Z');
    const queries: Array<Readonly<{ text: string; values: readonly unknown[] }>> = [];
    const database = {
      query: async (text: string, values: readonly unknown[] = []) => {
        queries.push({ text, values });
        const accepted = Array.isArray(values[4]) && values[4].includes(hash(currentSessionToken));
        return {
          rows: accepted ? [{ target: 'console', expires_at: sessionExpiresAt }] : [],
          rowCount: accepted ? 1 : 0,
        } as unknown as QueryResult;
      },
    };
    const tickets = new PgAuthTicket();
    const exchange = {
      ticket: 't'.repeat(64),
      state: 's'.repeat(32),
      nonce: 'n'.repeat(32),
      verifier: 'v'.repeat(43),
    };

    await expect(withWriteTransaction(database.query, (context) => tickets.consume(context, exchange, ['wrong-session-token'], nextSessionToken))).rejects.toThrow('AUTH_TICKET_EXCHANGE_REJECTED');
    await expect(withWriteTransaction(database.query, (context) => tickets.consume(context, exchange, [currentSessionToken], nextSessionToken))).resolves.toMatchObject({
      sessionExpiresAt,
      target: 'console',
    });

    expect(queries).toHaveLength(2);
    const accepted = queries[1]!;
    expect(accepted.values[4]).toEqual([hash(currentSessionToken)]);
    expect(accepted.values[5]).toBe(hash(nextSessionToken));
    expect(accepted.values[4]).not.toContain(accepted.values[5]);
    expect(accepted.text).toContain('session.token_hash=any($5::text[])');
    expect(accepted.text).toContain('for update of ticket,session');
    expect(accepted.text).toContain('update identity.authticket ticket set consumed_at=clock_timestamp()');
    expect(accepted.text).toContain('update identity.session session set token_hash=$6');
    expect(accepted.text).toContain('where session.id=consumed.session_id and session.token_hash=any($5::text[])');
    expect(accepted.text).toContain('select target,expires_at from rotated');
  });
});

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
