import { describe, expect, it } from 'vitest';
import { createWanlianAuth } from '../Auth';

describe('wanlian authentication contract', () => {
  it('fails closed when a signed secret field is absent', () => {
    expect(() => createWanlianAuth({})).toThrow();
  });
});
