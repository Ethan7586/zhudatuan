import { describe, expect, it } from 'vitest';
import { createJdAuth } from '../Auth';

describe('jd authentication contract', () => {
  it('fails closed when a signed secret field is absent', () => {
    expect(() => createJdAuth({})).toThrow();
  });
});
