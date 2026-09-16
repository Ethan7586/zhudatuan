import { describe, expect, it } from 'vitest';
import { buildMemberDirectoryQuery } from '../04_adapters_shixian/persistence/MemberDirectoryQuery';

describe('shared member directory query', () => {
  it('keeps one query across simulated Mall scopes without node-specific SQL', () => {
    const queries = ['mall:zhudatuan', 'mall:hbbtzn', 'mall:h6'].map((scope) =>
      buildMemberDirectoryQuery(scope, '王小明', null, 25, null));
    expect(new Set(queries.map(({ text }) => text)).size).toBe(1);
    expect(queries.map(({ values }) => values[0])).toEqual(['mall:zhudatuan', 'mall:hbbtzn', 'mall:h6']);
    expect(queries[0]?.text).toContain("membership.client='storefront'");
  });

  it('keeps cursor and identity-code resolution as query parameters', () => {
    const query = buildMemberDirectoryQuery('mall:hbbtzn', 'MB-TEST', 'membership:cursor', 51, 'membership:target');
    expect(query.values).toEqual(['mall:hbbtzn', 'MB-TEST', 'membership:cursor', 51, 'membership:target']);
    expect(query.text).toContain('membership.id=$5');
  });
});
