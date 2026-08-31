import { beforeEach, describe, expect, it, vi } from 'vitest';

const redis = vi.hoisted(() => {
  const listeners = new Map<string, (cause: unknown) => void>();
  const client = {
    isOpen: true,
    isReady: true,
    on: vi.fn((event: string, listener: (cause: unknown) => void) => listeners.set(event, listener)),
    connect: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    destroy: vi.fn(),
    get: vi.fn(async () => null),
    set: vi.fn(async () => 'OK'),
    del: vi.fn(async () => 1),
  };
  return { client, listeners };
});

vi.mock('redis', () => ({ createClient: () => redis.client }));

import { RedisCache } from './RedisCache';

describe('Redis cache availability', () => {
  beforeEach(() => {
    redis.listeners.clear();
    vi.clearAllMocks();
    redis.client.isOpen = true;
    redis.client.isReady = true;
  });

  it('notifies a full-jobs supervisor when an established connection degrades', async () => {
    const cache = new RedisCache(async () => 'rediss://staging.redis.example:6379');
    const unavailable = vi.fn();
    cache.onUnavailable(unavailable);
    await cache.start();
    expect(cache.state()).toEqual({ available: true });
    redis.listeners.get('error')?.(new Error('ECONNRESET:provider detail'));
    expect(unavailable).toHaveBeenCalledWith({ available: false, reason: 'ECONNRESET' });
  });

  it('does not notify repeatedly after the first available-to-unavailable transition', async () => {
    const cache = new RedisCache(async () => 'rediss://staging.redis.example:6379');
    const unavailable = vi.fn();
    cache.onUnavailable(unavailable);
    await cache.start();
    redis.listeners.get('error')?.(new Error('ECONNRESET'));
    redis.listeners.get('error')?.(new Error('ECONNRESET'));
    expect(unavailable).toHaveBeenCalledTimes(1);
  });
});
