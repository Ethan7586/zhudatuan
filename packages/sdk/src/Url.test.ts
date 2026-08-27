import { describe, expect, it } from 'vitest';
import { withCursor } from './url';

describe('cursor URL state', () => {
  it('returns a new search value while retaining the remaining URL state', () => {
    const current = new URLSearchParams('q=tea&cursor=old');
    const next = withCursor(current, 'new');
    expect(current.toString()).toBe('q=tea&cursor=old');
    expect(next.toString()).toBe('q=tea&cursor=new');
  });
});
