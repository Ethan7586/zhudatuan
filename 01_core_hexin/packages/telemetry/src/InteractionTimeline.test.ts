import { describe, expect, it, vi } from 'vitest';
import type { Metrics } from './Metrics';
import { createInteractionTimeline } from './InteractionTimeline';

describe('interaction timeline', () => {
  it('records monotonic stages through the shared metrics contract', () => {
    const times = [10, 10, 42];
    const duration = vi.fn();
    const metrics: Metrics = { count: vi.fn(), duration };
    const records: unknown[] = [];
    const timeline = createInteractionTimeline<'pointerdown' | 'local-update'>({
      name: 'cart.add',
      now: () => times.shift() ?? 42,
      metrics,
      onRecord: (record) => records.push(record),
    });
    const id = timeline.begin('listing:one', 'pointerdown');
    const record = timeline.finish('local-update', 'listing:one', id);
    expect(record?.elapsedMs).toBe(32);
    expect(records).toHaveLength(2);
    expect(duration).toHaveBeenLastCalledWith('cart.add.local-update', 32, expect.objectContaining({ resourceId: 'listing:one', phase: 'local-update' }));
  });

  it('ignores stale interaction identifiers without a browser environment', () => {
    const timeline = createInteractionTimeline({ name: 'test', now: () => 1 });
    timeline.begin('resource', 'start');
    expect(timeline.record('end', 'resource', 'stale')).toBeUndefined();
  });
});
