// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { IdentitySdk } from '../../src/shared/api/Client';
import { exchangeSession } from '../../src/shared/api/Exchange';
import type { Authorization } from '../../src/shared/security/Authorization';
import { environment, expectCommandContext, identitySdk } from '../TestData';

const authorization: Authorization = Object.freeze({
  request: Object.freeze({ state: 'state', nonce: 'nonce', challenge: 'challenge' }),
  secret: Object.freeze({ state: 'state', nonce: 'nonce', verifier: 'verifier' }),
});

describe('session ticket exchange', () => {
  it('binds the one-time ticket to state, nonce, PKCE verifier, target and request context', async () => {
    const exchange = vi.fn<IdentitySdk['ticketsExchange']>(async () => ({
      returnTarget: { url: 'http://127.0.0.1:3000/orders', proof: 'signed-proof', expiresAt: '2099-01-01T00:00:00.000Z', target: 'storefront' as const },
      expiresIn: 3600,
    }));
    const sdk = identitySdk({ ticketsExchange: exchange });

    await expect(exchangeSession(sdk, environment, { ticket: 'ticket-1', returnTarget: 'signed-return' }, authorization, 'storefront', 'csrf-token')).resolves.toBe(
      'http://127.0.0.1:3000/orders'
    );
    expect(exchange.mock.calls[0]?.[0].body).toEqual({
      ticket: 'ticket-1',
      state: 'state',
      nonce: 'nonce',
      verifier: 'verifier',
      returnTarget: 'signed-return',
    });
    expectCommandContext(exchange.mock.calls[0]?.[1]);
  });

  it('rejects a server return target for a different application', async () => {
    const exchange = vi.fn<IdentitySdk['ticketsExchange']>(async () => ({
      returnTarget: { url: 'http://127.0.0.1:4173', proof: 'signed-proof', expiresAt: '2099-01-01T00:00:00.000Z', target: 'console' as const },
      expiresIn: 3600,
    }));

    await expect(exchangeSession(identitySdk({ ticketsExchange: exchange }), environment, { ticket: 'ticket-1', returnTarget: 'signed-return' }, authorization, 'storefront', 'csrf-token')).rejects.toThrow(
      'RETURN_TARGET_INVALID'
    );
  });
});
