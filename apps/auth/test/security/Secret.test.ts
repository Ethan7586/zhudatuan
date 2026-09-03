// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { clearSecretInput, Secret } from '../../src/shared/security/Secret';

describe('Secret', () => {
  it('replaces, takes and clears a secret without serializable public fields', () => {
    const secret = new Secret();
    secret.set('first');
    secret.set('second');
    expect(secret.read()).toBe('second');
    expect(secret.take()).toBe('second');
    expect(secret.read()).toBe('');
    expect(JSON.stringify(secret)).not.toContain('second');
  });

  it('clears both the memory holder and the DOM field', () => {
    const input = document.createElement('input');
    const secret = new Secret();
    input.value = 'Secret-12345!';
    secret.set(input.value);
    clearSecretInput(input, secret);
    expect(input.value).toBe('');
    expect(secret.read()).toBe('');
  });
});
