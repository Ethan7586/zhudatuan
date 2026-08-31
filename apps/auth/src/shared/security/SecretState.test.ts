import { describe, expect, it } from 'vitest';
import { SecretState } from './SecretState';

describe('SecretState', () => {
  it('destroys an invitation when it is taken', () => {
    const secret = new SecretState();
    secret.set('invitation-secret');
    expect(secret.take()).toBe('invitation-secret');
    expect(secret.take()).toBe('');
  });
});
