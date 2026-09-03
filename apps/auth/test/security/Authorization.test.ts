// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { AuthorizationFactory, createAuthorization } from '../../src/shared/security/Authorization';

describe('authorization binding', () => {
  it('creates independent state, nonce and PKCE verifier while exposing only the challenge', async () => {
    const authorization = await createAuthorization();
    expect(authorization.request.state).toBe(authorization.secret.state);
    expect(authorization.request.nonce).toBe(authorization.secret.nonce);
    expect(authorization.request.challenge).not.toBe(authorization.secret.verifier);
    expect(authorization.secret.state).not.toBe(authorization.secret.nonce);
    expect(authorization.request.challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(JSON.stringify(authorization.request)).not.toContain(authorization.secret.verifier);
  });

  it('prewarms one authorization and never reuses it for a second command', async () => {
    const factory = new AuthorizationFactory();
    factory.prewarm();
    const first = await factory.create();
    const second = await factory.create();
    expect(second.secret.verifier).not.toBe(first.secret.verifier);
    expect(second.request.state).not.toBe(first.request.state);
  });
});
