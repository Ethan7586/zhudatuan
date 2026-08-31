import { describe, expect, it } from 'vitest';
import { createCakeuncleAuth } from './Auth';

describe('cakeuncle authentication contract', () => {
  it('fails closed when a signed secret field is absent', () => {
    expect(() => createCakeuncleAuth({})).toThrow();
  });
});
