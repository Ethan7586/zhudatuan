import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AuthTransaction } from '../02_domain_yewu/models_moxing/AuthTransaction';
import { ReturnTargetSigner } from '../04_adapters_shixian/providers_waibu/ReturnTargetSigner';

describe('identity authorization transaction', () => {
  it('binds state, nonce and the PKCE verifier challenge', () => {
    const verifier = 'v'.repeat(64);
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const started = AuthTransaction.start({ state: 's'.repeat(48), nonce: 'n'.repeat(48), challenge });
    const completed = AuthTransaction.complete({ ticket: 't'.repeat(86), state: started.state, nonce: started.nonce, verifier });
    expect(completed.challenge).toBe(challenge);
    expect(() => AuthTransaction.complete({ ticket: 't'.repeat(86), state: started.state, nonce: started.nonce, verifier: 'wrong' })).toThrow('AUTH_PKCE_VERIFIER_INVALID');
  });

  it('signs the realm-bound return origin supplied by the consumed ticket', () => {
    const signed = new ReturnTargetSigner('k'.repeat(64)).issue(
      'storefront', 'https://storefront.example.com', new Date('2026-08-21T00:00:00.000Z'),
    );
    expect(signed.url).toBe('https://storefront.example.com');
    expect(signed.proof.split('.')).toHaveLength(2);
    expect(signed.expiresAt).toBe('2026-08-21T00:01:00.000Z');
    expect(() => new ReturnTargetSigner('k'.repeat(64)).issue('storefront', 'https://storefront.example.com?node=other'))
      .toThrow('AUTH_RETURN_TARGET_INVALID');
  });
});
