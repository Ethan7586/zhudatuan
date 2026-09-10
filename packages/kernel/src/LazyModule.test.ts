import { describe, expect, it, vi } from 'vitest';
import { LazyModule } from './LazyModule';

describe('LazyModule', () => {
  it('starts eagerly and shares the successful module', async () => {
    const loader = vi.fn().mockResolvedValue({ value: 'ready' });
    const module = new LazyModule(loader);
    module.preload();
    await expect(Promise.all([module.load(), module.load()])).resolves.toEqual([{ value: 'ready' }, { value: 'ready' }]);
    expect(loader).toHaveBeenCalledOnce();
  });

  it('allows a failed module request to be retried', async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ value: 'ready' });
    const module = new LazyModule(loader);
    await expect(module.load()).rejects.toThrow('offline');
    await expect(module.load()).resolves.toEqual({ value: 'ready' });
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
