import { describe, expect, it } from 'vitest';
import { createTmallAuth } from './Auth';

describe('tmall authentication contract', () => {
  it('fails closed when a signed secret field is absent', () => {
    expect(() => createTmallAuth({})).toThrow();
  });
});
