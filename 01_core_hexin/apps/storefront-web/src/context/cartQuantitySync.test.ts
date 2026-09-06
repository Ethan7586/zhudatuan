import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCartQuantitySync, type CartQuantityUpdate } from './cartQuantitySync';

afterEach(() => vi.useRealTimers());

describe('cart quantity sync', () => {
  it('keeps the UI burst local and writes only the latest quantity', async () => {
    vi.useFakeTimers();
    const write = vi.fn(async (_update: CartQuantityUpdate) => undefined);
    const sync = createCartQuantitySync(write, vi.fn());

    sync.schedule({ cartItemId: 'cart:one', listingId: 'listing:one', quantity: 2 });
    sync.schedule({ cartItemId: 'cart:one', listingId: 'listing:one', quantity: 18 });
    sync.schedule({ cartItemId: 'cart:one', listingId: 'listing:one', quantity: 550 });

    expect(write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(350);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith({ cartItemId: 'cart:one', listingId: 'listing:one', quantity: 550 });
  });

  it('flushes the latest quantity before checkout', async () => {
    vi.useFakeTimers();
    const write = vi.fn(async (_update: CartQuantityUpdate) => undefined);
    const sync = createCartQuantitySync(write, vi.fn());

    sync.schedule({ cartItemId: 'cart:one', listingId: 'listing:one', quantity: 550 });
    await sync.flush();

    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]?.[0].quantity).toBe(550);
  });

  it('merges a direct 550 input and 50 rapid plus operations into one request', async () => {
    vi.useFakeTimers();
    const write = vi.fn(async (_update: CartQuantityUpdate) => undefined);
    const sync = createCartQuantitySync(write, vi.fn());

    sync.schedule({ cartItemId: 'cart:one', listingId: 'listing:one', quantity: 550 });
    for (let quantity = 551; quantity <= 600; quantity += 1) {
      sync.schedule({ cartItemId: 'cart:one', listingId: 'listing:one', quantity });
    }

    expect(write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(350);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]?.[0].quantity).toBe(600);
  });

  it('keeps a failed latest quantity available for the next flush', async () => {
    vi.useFakeTimers();
    const write = vi.fn<(update: CartQuantityUpdate) => Promise<void>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined);
    const onError = vi.fn();
    const sync = createCartQuantitySync(write, onError);

    sync.schedule({ cartItemId: 'cart:one', listingId: 'listing:one', quantity: 550 });
    await vi.advanceTimersByTimeAsync(350);
    expect(onError).toHaveBeenCalledTimes(1);

    await sync.flush();
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[1]?.[0].quantity).toBe(550);
  });

  it('retries automatically after a short offline period without a request storm', async () => {
    vi.useFakeTimers();
    const write = vi.fn<(update: CartQuantityUpdate) => Promise<void>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined);
    const sync = createCartQuantitySync(write, vi.fn());

    sync.schedule({ cartItemId: 'cart:one', listingId: 'listing:one', quantity: 550 });
    await vi.advanceTimersByTimeAsync(350);
    expect(write).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(write).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(write).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1_999);
    expect(write).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(write).toHaveBeenCalledTimes(3);
    expect(write.mock.calls[2]?.[0].quantity).toBe(550);
  });
});
