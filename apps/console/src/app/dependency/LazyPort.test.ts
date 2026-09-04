import { describe, expect, it, vi } from 'vitest';
import { lazyPort } from './LazyPort';

interface ReadPort {
  read(value: string): Promise<string>;
}

describe('lazyPort', () => {
  it('loads one port for concurrent calls and preserves its receiver', async () => {
    const port: ReadPort = {
      read(value) {
        return Promise.resolve(`${value}:${this === port}`);
      },
    };
    const load = vi.fn(() => Promise.resolve(port));
    const subject = lazyPort(load);

    await expect(Promise.all([subject.read('first'), subject.read('second')])).resolves.toEqual(['first:true', 'second:true']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('allows a failed chunk load to be retried', async () => {
    const port: ReadPort = { read: (value) => Promise.resolve(value) };
    const load = vi.fn<() => Promise<ReadPort>>().mockRejectedValueOnce(new Error('CHUNK_UNAVAILABLE')).mockResolvedValue(port);
    const subject = lazyPort(load);

    await expect(subject.read('first')).rejects.toThrow('CHUNK_UNAVAILABLE');
    await expect(subject.read('second')).resolves.toBe('second');
    expect(load).toHaveBeenCalledTimes(2);
  });
});
