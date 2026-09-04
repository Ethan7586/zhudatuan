import { describe, expect, it, vi } from 'vitest';
import { Bulkhead } from './Bulkhead';
import { CircuitBreaker } from './CircuitBreaker';
import { Deadline } from './deadline';
import { retry } from './Retry';

describe('resilience primitives', () => {
  it('rejects work beyond a bulkhead queue', async () => {
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const bulkhead = new Bulkhead(1, 0);
    const running = bulkhead.run(() => blocked);
    await expect(bulkhead.run(() => Promise.resolve())).rejects.toThrow('BULKHEAD_REJECTED');
    release();
    await running;
  });

  it('opens and recovers a circuit with one half-open probe', async () => {
    let now = 0;
    const circuit = new CircuitBreaker(2, 100, () => now);
    await expect(circuit.run(() => Promise.reject(new Error('failure')))).rejects.toThrow('failure');
    await expect(circuit.run(() => Promise.reject(new Error('failure')))).rejects.toThrow('failure');
    await expect(circuit.run(() => Promise.resolve())).rejects.toThrow('CIRCUIT_OPEN');
    now = 100;
    await expect(circuit.run(() => Promise.resolve('healthy'))).resolves.toBe('healthy');
    expect(circuit.snapshot()).toBe('closed');
  });

  it('retries only within the declared safe mode and total deadline', async () => {
    const work = vi.fn().mockRejectedValueOnce(new Error('temporary')).mockResolvedValue('done');
    const deadline = Deadline.after(1_000);
    await expect(retry(work, { mode: 'read', attempts: 2, minimumDelayMilliseconds: 0, maximumDelayMilliseconds: 0,
      deadline, retryable: () => true, random: () => 0 })).resolves.toBe('done');
    expect(work).toHaveBeenCalledTimes(2);
    deadline.dispose();
  });
});
