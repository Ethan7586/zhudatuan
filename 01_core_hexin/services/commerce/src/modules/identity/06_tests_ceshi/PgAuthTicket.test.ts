import { createHash } from 'node:crypto';
import type { QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { PgAuthTicket } from '../04_adapters_shixian/persistence_cunchu/PgAuthTicket';
import { ReturnTargetSigner } from '../04_adapters_shixian/providers_waibu/ReturnTargetSigner';
import { AuthTransaction } from '../02_domain_yewu/models_moxing/AuthTransaction';

describe('PgAuthTicket exchange', () => {
  it('persists the issuing session account and realm on the ticket', async () => {
    const queries: Array<Readonly<{ text: string; values: readonly unknown[] }>> = [];
    const database = { query: async (text: string, values: readonly unknown[] = []) => {
      queries.push({ text, values });
      return { rows: [], rowCount: 1 } as unknown as QueryResult;
    } } as OperationDatabase;
    const tickets = new PgAuthTicket(new ReturnTargetSigner('key'));
    const transaction = AuthTransaction.start({
      state: 's'.repeat(32), nonce: 'n'.repeat(32), challenge: 'c'.repeat(43),
    });

    await tickets.issue(database, 'session:l11', 'realm:l11', 'account:l11', 'storefront', transaction);

    expect(queries[0]?.text).toContain('realm_id,account_id');
    expect(queries[0]?.values.slice(-3)).toEqual(['storefront', 'realm:l11', 'account:l11']);
  });

  it('binds the ticket to the current session and consumes it once', async () => {
    const currentSessionToken = 'current-session-token';
    const sessionExpiresAt = new Date('2026-08-28T16:00:00.000Z');
    const queries: Array<Readonly<{ text: string; values: readonly unknown[] }>> = [];
    let consumed = false;
    let successfulConsumes = 0;
    const database = {
      query: async (text: string, values: readonly unknown[] = []) => {
        queries.push({ text, values });
        const accepted = values[4] === hash(currentSessionToken) && values[5] === 'realm:l0' && !consumed;
        if (accepted) {
          consumed = true;
          successfulConsumes += 1;
        }
        return {
          rows: accepted ? [{ target: 'console', return_origin: 'https://console.registry.example', expires_at: sessionExpiresAt }] : [],
          rowCount: accepted ? 1 : 0,
        } as unknown as QueryResult;
      },
    } as OperationDatabase;
    const tickets = new PgAuthTicket(new ReturnTargetSigner('return-target-signing-key'));
    const exchange = {
      ticket: 't'.repeat(64),
      state: 's'.repeat(32),
      nonce: 'n'.repeat(32),
      verifier: 'v'.repeat(43),
    };

    await expect(tickets.consume(database, exchange, 'wrong-session-token', 'realm:l0')).rejects.toThrow('AUTH_TICKET_EXCHANGE_REJECTED');
    await expect(tickets.consume(database, exchange, currentSessionToken, 'realm:l1')).rejects.toThrow('AUTH_TICKET_EXCHANGE_REJECTED');
    await expect(tickets.consume(database, exchange, currentSessionToken, 'realm:l0')).resolves.toMatchObject({
      returnTarget: { url: 'https://console.registry.example' },
      sessionExpiresAt,
    });
    await expect(tickets.consume(database, exchange, currentSessionToken, 'realm:l0'))
      .rejects.toThrow('AUTH_TICKET_EXCHANGE_REJECTED');

    expect(queries).toHaveLength(4);
    expect(successfulConsumes).toBe(1);
    const accepted = queries[2]!;
    expect(accepted.values[4]).toBe(hash(currentSessionToken));
    expect(accepted.values).toHaveLength(6);
    expect(accepted.text).toContain('session.token_hash=$5');
    expect(accepted.text).toContain('ticket.realm_id=$6');
    expect(accepted.text).toContain('target.return_origin');
    expect(accepted.text).toContain('for update of ticket');
    expect(accepted.text).toContain('update identity.authticket ticket set consumed_at=clock_timestamp()');
    expect(accepted.text).not.toContain('update identity.session');
    expect(queries[3]?.values).toEqual(accepted.values);
  });
});

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
