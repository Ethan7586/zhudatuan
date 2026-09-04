import { describe, expect, it } from 'vitest';
import { defineQueryState, enumQuery, integerQuery, optionalEnumQuery, optionalQuery, pageCursor, stringQuery, trimmedQuery } from './QueryState';

const state = defineQueryState({
  q: stringQuery('', 20),
  view: enumQuery(['all', 'failed'] as const, 'all'),
  limit: integerQuery(50, [20, 50]),
  cursor: optionalQuery(),
  reference: trimmedQuery(12),
  kind: optionalEnumQuery(['catalog', 'order'] as const),
});

describe('URL query state', () => {
  it('decodes one canonical set of defaults and rejects invalid values', () => {
    expect(state.read(new URLSearchParams('q=milk&view=unknown&limit=999&cursor=&reference=%20ref%3A1%20'))).toEqual({
      q: 'milk', view: 'all', limit: 50, cursor: undefined, reference: 'ref:1', kind: undefined,
    });
  });

  it('encodes patches, omits defaults and preserves unrelated route state', () => {
    const next = state.patch(new URLSearchParams('selected=item%3A1&view=failed&cursor=old'), { view: 'all', limit: 20, cursor: undefined });
    expect(next.toString()).toBe('selected=item%3A1&limit=20');
  });

  it('resets only owned keys and advances an opaque cursor without decoding it', () => {
    expect(state.reset(new URLSearchParams('q=milk&view=failed&selected=item%3A1')).toString()).toBe('selected=item%3A1');
    expect(pageCursor(new URLSearchParams('q=milk'), 'cursor:2/+').toString()).toBe('q=milk&cursor=cursor%3A2%2F%2B');
  });

  it('creates a canonical query without exposing URL encoding at call sites', () => {
    expect(state.create({ kind: 'catalog', view: 'all', limit: 50 }).toString()).toBe('kind=catalog');
  });
});
