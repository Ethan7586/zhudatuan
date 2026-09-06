import { describe, expect, it } from 'vitest';
import { pkceS256Challenge } from './BrowserAuthorization';

describe('browser authorization', () => {
  it('creates the RFC 7636 S256 challenge without Web Crypto', async () => {
    await expect(pkceS256Challenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk', null))
      .resolves.toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('keeps the fallback result identical to Web Crypto', async () => {
    const verifier = 'v'.repeat(64);
    const native = (value: ArrayBuffer) => globalThis.crypto.subtle.digest('SHA-256', value);
    await expect(pkceS256Challenge(verifier, null)).resolves.toBe(await pkceS256Challenge(verifier, native));
  });
});
