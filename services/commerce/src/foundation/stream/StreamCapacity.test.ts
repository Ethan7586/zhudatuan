import { describe, expect, it } from 'vitest';
import { StreamCapacity } from './StreamCapacity';

describe('StreamCapacity', () => {
  it('enforces both global and per-scope limits and releases exactly once', () => {
    const capacity = new StreamCapacity(2, 1);
    const first = capacity.acquire(['mall:one', 'mall:one']);
    expect(() => capacity.acquire(['mall:one'])).toThrow('RATE_LIMITED');
    const second = capacity.acquire(['mall:two']);
    expect(() => capacity.acquire(['mall:three'])).toThrow('RATE_LIMITED');

    first.release();
    first.release();
    expect(() => capacity.acquire(['mall:two'])).toThrow('RATE_LIMITED');
    second.release();
    expect(() => capacity.acquire([])).toThrow('RATE_LIMITED');
  });
});
