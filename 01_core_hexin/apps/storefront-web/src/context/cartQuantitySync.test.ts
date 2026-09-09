import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCartQuantitySync, type CartQuantityUpdate } from './cartQuantitySync';

const update = (quantity: number, previousQuantity = 1, cartItemId = 'cart:one'): CartQuantityUpdate => ({
  cartItemId,
  listingId: cartItemId.replace('cart:', 'listing:'),
  previousQuantity,
  quantity,
});

afterEach(() => vi.useRealTimers());

describe('cart quantity sync', () => {
  it('keeps a five-click burst local and writes only the latest absolute quantity', async () => {
    vi.useFakeTimers();
    const write = vi.fn(async (_update: CartQuantityUpdate) => undefined);
    const sync = createCartQuantitySync(write, { onError: vi.fn() });

    for (let quantity = 2; quantity <= 6; quantity += 1) sync.schedule(update(quantity, quantity - 1));

    expect(write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(180);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(update(6, 5));
  });

  it('lets different products sync without blocking each other', async () => {
    vi.useFakeTimers();
    const write = vi.fn(async (_update: CartQuantityUpdate) => undefined);
    const sync = createCartQuantitySync(write, { onError: vi.fn() });

    sync.schedule(update(2));
    sync.schedule(update(4, 3, 'cart:two'));
    await vi.advanceTimersByTimeAsync(180);

    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls.map(([entry]) => entry.cartItemId).sort()).toEqual(['cart:one', 'cart:two']);
  });

  it('queues a newer value behind an active request without letting the old result overwrite it', async () => {
    vi.useFakeTimers();
    let releaseFirst!: () => void;
    const first = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const write = vi.fn<(entry: CartQuantityUpdate) => Promise<void>>()
      .mockReturnValueOnce(first)
      .mockResolvedValue(undefined);
    const committed = vi.fn();
    const sync = createCartQuantitySync(write, { onCommitted: committed, onError: vi.fn() });

    sync.schedule(update(2));
    await vi.advanceTimersByTimeAsync(180);
    sync.schedule(update(6, 2));
    releaseFirst();
    await first;
    await vi.runAllTimersAsync();

    expect(write.mock.calls.map(([entry]) => entry.quantity)).toEqual([2, 6]);
    expect(committed.mock.calls.map(([entry]) => entry.quantity)).toEqual([2, 6]);
  });

  it('reports the last confirmed quantity and drops newer optimistic values after failure', async () => {
    vi.useFakeTimers();
    let rejectFirst!: (cause: Error) => void;
    const first = new Promise<void>((_resolve, reject) => { rejectFirst = reject; });
    const onError = vi.fn();
    const write = vi.fn<(entry: CartQuantityUpdate) => Promise<void>>().mockReturnValue(first);
    const sync = createCartQuantitySync(write, { onError });

    sync.schedule(update(2, 1));
    await vi.advanceTimersByTimeAsync(180);
    sync.schedule(update(5, 2));
    rejectFirst(new Error('offline'));
    await expect(first).rejects.toThrow('offline');
    await vi.runAllTimersAsync();

    expect(write).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error), {
      update: update(2, 1),
      rollbackQuantity: 1,
    });
    expect(sync.hasPending()).toBe(false);
  });

  it('flushes the latest value before checkout', async () => {
    vi.useFakeTimers();
    const write = vi.fn(async (_update: CartQuantityUpdate) => undefined);
    const sync = createCartQuantitySync(write, { onError: vi.fn() });

    sync.schedule(update(550));
    await sync.flush();

    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]?.[0].quantity).toBe(550);
    expect(sync.hasPending()).toBe(false);
  });
});
