import { describe, expect, it, vi } from 'vitest';
import { Singleflight } from './Singleflight';

describe('Singleflight', () => {
  it('shares one operation and never caches its result', async () => {
    let resolve!: (value: string) => void;
    const operation = vi.fn(
      () =>
        new Promise<string>((done) => {
          resolve = done;
        })
    );
    const singleflight = new Singleflight();
    const first = singleflight.run('key', operation);
    const second = singleflight.run('key', operation);
    resolve('value');
    await expect(Promise.all([first, second])).resolves.toEqual(['value', 'value']);
    expect(operation).toHaveBeenCalledTimes(1);
    await singleflight.run('key', () => Promise.resolve('next'));
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('cancels one waiter without cancelling work observed by another waiter', async () => {
    const waiter = new AbortController();
    const singleflight = new Singleflight();
    const operation = () => new Promise<string>((resolve) => setTimeout(() => resolve('ok'), 5));
    const first = singleflight.run('key', operation, { signal: waiter.signal });
    const second = singleflight.run('key', operation);
    waiter.abort(new Error('cancelled'));
    await expect(first).rejects.toThrow('cancelled');
    await expect(second).resolves.toBe('ok');
  });
});
