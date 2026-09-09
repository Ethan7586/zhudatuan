import { describe, expect, it } from 'vitest';
import { clearAdvancedSupportFilter, readSupportFilter } from './SupportFilter';

describe('readSupportFilter', () => {
  it('keeps only supported queue facets and discards stale pagination state', () => {
    const filter = readSupportFilter(new URLSearchParams('ownership=all&states=closed&priorities=urgent&unread=true&cursor=stale&skill=refund'), '  退款  ');

    expect(filter).toEqual({ limit: 50, ownership: 'all', states: ['closed'], priorities: ['urgent'], skill: 'refund', unread: true, keyword: '退款' });
  });

  it('fails invalid facet values back to the safe personal queue', () => {
    expect(readSupportFilter(new URLSearchParams('ownership=unknown&states=broken&priorities=critical'), '')).toEqual({ limit: 50, ownership: 'mine' });
  });

  it('clears advanced facets together while preserving frequent choices', () => {
    const search = clearAdvancedSupportFilter(new URLSearchParams('ownership=all&states=open&skill=refund&agentId=agent:one&unread=true&updatedAfter=2026-09-09&cursor=stale'));

    expect(search.toString()).toBe('ownership=all&states=open');
  });
});
