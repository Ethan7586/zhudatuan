import { spawnSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { Bulkhead } from './Bulkhead';
import { CircuitBreaker } from './CircuitBreaker';
import { Deadline } from './deadline';
import { retry, retryDelay } from './Retry';

describe('resilience primitives', () => {
  it('rejects work beyond a bulkhead queue', async () => {
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
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

  it('bounds the rolling failure window and reports state transitions', async () => {
    let now = 0;
    const transitions: string[] = [];
    const circuit = new CircuitBreaker(
      2,
      100,
      () => now,
      3,
      ({ previous, current }) => transitions.push(`${previous}:${current}`)
    );
    await circuit.run(() => Promise.resolve());
    await expect(circuit.run(() => Promise.reject(new Error('first')))).rejects.toThrow('first');
    await circuit.run(() => Promise.resolve());
    await circuit.run(() => Promise.resolve());
    await expect(circuit.run(() => Promise.reject(new Error('second')))).rejects.toThrow('second');
    expect(circuit.snapshot()).toBe('closed');
    await expect(circuit.run(() => Promise.reject(new Error('third')))).rejects.toThrow('third');
    expect(circuit.snapshot()).toBe('open');
    now = 100;
    expect(circuit.snapshot()).toBe('halfopen');
    await circuit.run(() => Promise.resolve());
    expect(transitions).toEqual(['closed:open', 'open:halfopen', 'halfopen:closed']);
  });

  it('retries only within the declared safe mode and total deadline', async () => {
    const work = vi.fn().mockRejectedValueOnce(new Error('temporary')).mockResolvedValue('done');
    const deadline = Deadline.after(1_000);
    await expect(retry(work, { mode: 'read', attempts: 2, minimumDelayMilliseconds: 0, maximumDelayMilliseconds: 0, deadline, retryable: () => true, random: () => 0 })).resolves.toBe('done');
    expect(work).toHaveBeenCalledTimes(2);
    deadline.dispose();
  });

  it('uses full jitter within the exponential ceiling', () => {
    expect(retryDelay(3, 100, 1_000, () => 0)).toBe(0);
    expect(retryDelay(3, 100, 1_000, () => 0.999)).toBeLessThanOrEqual(400);
  });

  it('keeps an awaited retry alive in a short-lived process', () => {
    const entry = new URL('./index.ts', import.meta.url).href;
    const source = `
      import { Deadline, retry } from ${JSON.stringify(entry)};
      let attempts = 0;
      const deadline = Deadline.after(1000);
      try {
        const value = await retry(async () => {
          attempts += 1;
          if (attempts === 1) throw new Error('temporary');
          return 'done';
        }, {
          mode: 'read', attempts: 2, minimumDelayMilliseconds: 20,
          maximumDelayMilliseconds: 20, deadline, retryable: () => true,
          random: () => 0.999
        });
        process.stdout.write(value);
      } finally {
        deadline.dispose();
      }
    `;
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', source], { encoding: 'utf8', timeout: 5_000 });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe('done');
  });
});
