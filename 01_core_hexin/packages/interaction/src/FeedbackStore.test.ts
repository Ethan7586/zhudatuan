import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFeedbackStore } from './FeedbackStore';

interface Message {
  readonly id: string;
  readonly channel: string;
  readonly text: string;
}

afterEach(() => vi.useRealTimers());

describe('feedback store', () => {
  it('keeps at most one message in a replacing channel', () => {
    const store = createFeedbackStore<Message>();
    store.publish({ id: 'one', channel: 'cart', text: 'one' });
    store.publish({ id: 'two', channel: 'cart', text: 'two' });
    expect(store.getSnapshot()).toEqual([{ id: 'two', channel: 'cart', text: 'two' }]);
  });

  it('can preserve append-style legacy feedback without mixing channels', () => {
    const store = createFeedbackStore<Message>();
    store.publish({ id: 'one', channel: 'default', text: 'one' }, { replaceChannel: false });
    store.publish({ id: 'two', channel: 'default', text: 'two' }, { replaceChannel: false });
    expect(store.getSnapshot()).toHaveLength(2);
  });

  it('expires feedback and releases timers on disposal', () => {
    vi.useFakeTimers();
    const store = createFeedbackStore<Message>();
    store.publish({ id: 'one', channel: 'cart', text: 'one' }, { durationMs: 1200 });
    vi.advanceTimersByTime(1200);
    expect(store.getSnapshot()).toEqual([]);
    store.publish({ id: 'two', channel: 'cart', text: 'two' }, { durationMs: 1200 });
    store.dispose();
    vi.runAllTimers();
    expect(store.getSnapshot()).toEqual([]);
  });
});
