import { describe, expect, it } from 'vitest';
import { orderProjection } from './OrderProjection';

describe('orderProjection', () => {
  it('canonicalizes PostgreSQL and JSONB timestamps throughout an order projection', () => {
    const projection = orderProjection({
      created_at: new Date('2026-09-08T00:00:00.000Z'),
      receivedAt: null,
      payment: { updatedAt: '2026-09-08T08:30:00+08:00' },
      fulfillments: [{ createdAt: '2026-09-08T00:00:00+00:00', milestones: [{ occurredAt: '2026-09-08T08:45:00+08:00' }] }],
      evidence: { createdAt: 'business-snapshot-version' },
      title: '2026-09-08T08:30:00+08:00',
    });

    expect(projection).toEqual({
      created_at: '2026-09-08T00:00:00.000Z',
      receivedAt: null,
      payment: { updatedAt: '2026-09-08T00:30:00.000Z' },
      fulfillments: [{ createdAt: '2026-09-08T00:00:00.000Z', milestones: [{ occurredAt: '2026-09-08T00:45:00.000Z' }] }],
      evidence: { createdAt: 'business-snapshot-version' },
      title: '2026-09-08T08:30:00+08:00',
    });
    expect(Object.isFrozen(projection)).toBe(true);
    expect(Object.isFrozen(projection.fulfillments)).toBe(true);
  });

  it.each([['invalid'], [42], [{}]])('rejects an invalid contract timestamp %j', (updatedAt) => {
    expect(() => orderProjection({ updatedAt })).toThrow('ORDER_PROJECTION_TIME_INVALID');
  });
});
