import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AuthTransaction } from '../domain/model/AuthTransaction';
import { ReturnTargetSigner } from '../infrastructure/security/ReturnTargetSigner';

describe('identity authorization transaction', () => {
  it('binds state, nonce and the PKCE verifier challenge', () => {
    const verifier = 'v'.repeat(64);
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const started = AuthTransaction.start({ state: 's'.repeat(48), nonce: 'n'.repeat(48), challenge });
    const completed = AuthTransaction.complete({ ticket: 't'.repeat(86), state: started.state, nonce: started.nonce, verifier });
    expect(completed.challenge).toBe(challenge);
    expect(() => AuthTransaction.complete({ ticket: 't'.repeat(86), state: started.state, nonce: started.nonce, verifier: 'wrong' })).toThrow('VALIDATION_FAILED');
  });

  it('issues an expiring proof only for configured targets', () => {
    const targets = {
      console: 'https://console.example.com',
      storefront: 'https://storefront.example.com',
      miniapp: 'https://miniapp.example.com',
      store: 'https://store.example.com',
      supplier: 'https://supplier.example.com',
    } as const;
    const signed = new ReturnTargetSigner(targets, 'k'.repeat(64)).issue('storefront', new Date('2026-08-21T00:00:00.000Z'));
    expect(signed.url).toBe(targets.storefront);
    expect(signed.proof.split('.')).toHaveLength(2);
    expect(signed.expiresAt).toBe('2026-08-21T00:10:00.000Z');
  });
});
