import { createHash } from 'node:crypto';
import type { QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { PgAuthTicket } from '../04_adapters_shixian/persistence_cunchu/PgAuthTicket';
import { ReturnTargetSigner } from '../04_adapters_shixian/providers_waibu/ReturnTargetSigner';

describe('PgAuthTicket exchange', () => {
  it('binds the ticket to the current session and consumes it once', async () => {
    const currentSessionToken = 'current-session-token';
    const sessionExpiresAt = new Date('2026-08-28T16:00:00.000Z');
    const queries: Array<Readonly<{ text: string; values: readonly unknown[] }>> = [];
    const database = {
      query: async (text: string, values: readonly unknown[] = []) => {
        queries.push({ text, values });
        const accepted = values[4] === hash(currentSessionToken);
        return {
          rows: accepted ? [{ target: 'console', expires_at: sessionExpiresAt }] : [],
          rowCount: accepted ? 1 : 0,
        } as unknown as QueryResult;
      },
    } as OperationDatabase;
    const tickets = new PgAuthTicket(
      new ReturnTargetSigner(
        {
          console: 'https://console.zhudatuan.com',
          storefront: 'https://zhudatuan.com',
          store: 'https://store.zhudatuan.com',
          supplier: 'https://supplier.zhudatuan.com',
        },
        'return-target-signing-key'
      )
    );
    const exchange = {
      ticket: 't'.repeat(64),
      state: 's'.repeat(32),
      nonce: 'n'.repeat(32),
      verifier: 'v'.repeat(43),
    };

    await expect(tickets.consume(database, exchange, 'wrong-session-token')).rejects.toThrow('AUTH_TICKET_EXCHANGE_REJECTED');
    await expect(tickets.consume(database, exchange, currentSessionToken)).resolves.toMatchObject({
      returnTarget: { url: 'https://console.zhudatuan.com' },
      sessionExpiresAt,
    });

    expect(queries).toHaveLength(2);
    const accepted = queries[1]!;
    expect(accepted.values[4]).toBe(hash(currentSessionToken));
    expect(accepted.values).toHaveLength(5);
    expect(accepted.text).toContain('session.token_hash=$5');
    expect(accepted.text).toContain('for update of ticket');
    expect(accepted.text).toContain('update identity.authticket ticket set consumed_at=clock_timestamp()');
    expect(accepted.text).not.toContain('update identity.session');
  });
});

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
