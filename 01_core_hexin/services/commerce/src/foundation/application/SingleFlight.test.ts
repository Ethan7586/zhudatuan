import { describe, expect, it, vi } from 'vitest';
import { SingleFlight } from './SingleFlight';

describe('SingleFlight', () => {
  it('shares one active load and starts a fresh load after completion', async () => {
    let release: ((value: number) => void) | undefined;
    const load = vi.fn(() => new Promise<number>((resolve) => { release = resolve; }));
    const flights = new SingleFlight<number>();

    const first = flights.run('same', load);
    const second = flights.run('same', load);
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(1);
    release?.(7);
    await expect(Promise.all([first, second])).resolves.toEqual([7, 7]);

    await Promise.resolve();
    const next = flights.run('same', async () => 8);
    await expect(next).resolves.toBe(8);
  });

  it('does not retain a failed load', async () => {
    const flights = new SingleFlight<number>();
    await expect(flights.run('retry', async () => { throw new Error('FAILED'); })).rejects.toThrow('FAILED');
    await expect(flights.run('retry', async () => 9)).resolves.toBe(9);
  });
});
