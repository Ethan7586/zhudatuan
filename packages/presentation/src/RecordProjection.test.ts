import { describe, expect, it } from 'vitest';
import { projectRecords } from './RecordProjection';

describe('projectRecords', () => {
  it('maps a page to stable non-sensitive rows', () => {
    const result = projectRecords({ items: [{ id: '1234567890abcdef', name: '门店订单', status: 'processing', updated_at: '2026-09-04T00:00:00.000Z' }], count: 3, nextCursor: 'next' });
    expect(result).toEqual({ rows: [{ key: '1234567890abcdef', title: '门店订单', detail: '123456…cdef', status: '处理中', timestamp: '2026-09-04 08:00' }], count: 3, nextCursor: 'next' });
  });

  it('turns an empty or invalid payload into an empty collection', () => {
    expect(projectRecords(null)).toEqual({ rows: [], count: 0, nextCursor: null });
  });
});
