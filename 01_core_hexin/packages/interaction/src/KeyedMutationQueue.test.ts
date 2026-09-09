import { afterEach, describe, expect, it, vi } from 'vitest';
import { createKeyedMutationQueue } from './KeyedMutationQueue';

interface Update {
  readonly key: string;
  readonly previous: number;
  readonly value: number;
}

const update = (value: number, previous = 1, key = 'one'): Update => ({ key, previous, value });

afterEach(() => vi.useRealTimers());

function createQueue(write: (value: Update, context: Readonly<{ signal: AbortSignal }>) => Promise<void>, onError = vi.fn(), onCommitted = vi.fn()) {
  return createKeyedMutationQueue((value, context) => write(value, context), {
    keyOf: (value) => value.key,
    initialConfirmedValue: (value) => value.previous,
    confirmedValue: (value) => value.value,
    onError,
    onCommitted,
    delayMs: 20,
  });
}

describe('keyed mutation queue', () => {
  it('collapses five rapid updates to the latest absolute value', async () => {
    vi.useFakeTimers();
    const write = vi.fn<(value: Update) => Promise<void>>().mockResolvedValue(undefined);
    const queue = createQueue(write);
    for (let value = 2; value <= 6; value += 1) queue.schedule(update(value, value - 1));
    await vi.advanceTimersByTimeAsync(20);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]?.[0]).toEqual(update(6, 5));
  });

  it('runs unrelated resource keys concurrently', async () => {
    vi.useFakeTimers();
    const active = new Set<string>();
    const releases: Array<() => void> = [];
    let maximum = 0;
    const write = vi.fn(
      (value: Update) =>
        new Promise<void>((resolve) => {
          active.add(value.key);
          maximum = Math.max(maximum, active.size);
          releases.push(() => {
            active.delete(value.key);
            resolve();
          });
        })
    );
    const queue = createQueue(write);
    queue.schedule(update(2, 1, 'one'));
    queue.schedule(update(3, 1, 'two'));
    await vi.advanceTimersByTimeAsync(20);
    expect(maximum).toBe(2);
    releases.forEach((release) => release());
    await queue.flush();
  });

  it('reports the confirmed value and drops newer pending work after failure', async () => {
    vi.useFakeTimers();
    let reject!: (cause: Error) => void;
    const first = new Promise<void>((_resolve, rejectPromise) => {
      reject = rejectPromise;
    });
    const onError = vi.fn();
    const queue = createQueue(
      vi.fn(() => first),
      onError
    );
    queue.schedule(update(2));
    await vi.advanceTimersByTimeAsync(20);
    queue.schedule(update(5, 2));
    reject(new Error('offline'));
    await expect(first).rejects.toThrow('offline');
    await vi.runAllTimersAsync();
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        update: update(2),
        rollbackValue: 1,
      })
    );
    expect(queue.hasPending()).toBe(false);
  });

  it('keeps a new operation scheduled during failure rollback', async () => {
    vi.useFakeTimers();
    const write = vi.fn<(value: Update) => Promise<void>>().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const committed = vi.fn();
    let queue: ReturnType<typeof createQueue>;
    const onError = vi.fn(() => {
      queue.schedule(update(3));
    });
    queue = createQueue(write, onError, committed);

    queue.schedule(update(2));
    await vi.advanceTimersByTimeAsync(20);
    await vi.runAllTimersAsync();

    expect(write.mock.calls.map(([value]) => value.value)).toEqual([2, 3]);
    expect(committed).toHaveBeenCalledWith(update(3), expect.objectContaining({ isLatest: true }));
    expect(queue.hasPending()).toBe(false);
  });

  it('serializes a newer revision behind an active write', async () => {
    vi.useFakeTimers();
    let release!: () => void;
    const first = new Promise<void>((resolve) => {
      release = resolve;
    });
    const write = vi.fn<(value: Update) => Promise<void>>().mockReturnValueOnce(first).mockResolvedValue(undefined);
    const committed = vi.fn();
    const queue = createQueue(write, vi.fn(), committed);
    queue.schedule(update(2));
    await vi.advanceTimersByTimeAsync(20);
    queue.schedule(update(6, 2));
    release();
    await first;
    await vi.runAllTimersAsync();
    expect(write.mock.calls.map(([value]) => value.value)).toEqual([2, 6]);
    expect(committed.mock.calls.map(([value]) => value.value)).toEqual([2, 6]);
  });

  it('suppresses stale callbacks and aborts active work after cancellation', async () => {
    vi.useFakeTimers();
    let release!: () => void;
    const active = new Promise<void>((resolve) => {
      release = resolve;
    });
    const committed = vi.fn();
    const onError = vi.fn();
    const observedSignals: AbortSignal[] = [];
    const queue = createQueue(
      (_value, context) => {
        observedSignals.push(context.signal);
        return active;
      },
      onError,
      committed
    );
    queue.schedule(update(2));
    await vi.advanceTimersByTimeAsync(20);
    queue.cancel();
    release();
    await active;
    expect(observedSignals[0]?.aborted).toBe(true);
    expect(committed).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});
