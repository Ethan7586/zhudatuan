import { describe, expect, it } from 'vitest';
import { createWenxuanAuth } from './Auth';

describe('wenxuan authentication contract', () => {
  it('fails closed when a signed secret field is absent', () => {
    expect(() => createWenxuanAuth({})).toThrow();
  });
});
