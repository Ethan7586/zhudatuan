import { describe, expect, it, vi } from 'vitest';
import { createPreloadRegistry } from './PreloadRegistry';

describe('preload registry', () => {
  it('deduplicates hover and pointer-down requests', async () => {
    const loader = vi.fn(async () => ({ ready: true }));
    const registry = createPreloadRegistry({ cart: loader });
    const hover = registry.preload('cart');
    const pointerDown = registry.preload('cart');
    expect(hover).toBe(pointerDown);
    await hover;
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('allows retry after a failed preload', async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ ready: true });
    const registry = createPreloadRegistry({ cart: loader });
    await expect(registry.preload('cart')).rejects.toThrow('offline');
    await expect(registry.preload('cart')).resolves.toEqual({ ready: true });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('uses an injected idle scheduler and does not require the DOM', async () => {
    const loader = vi.fn(async () => undefined);
    const registry = createPreloadRegistry({ cart: loader });
    let work: (() => void) | undefined;
    const cancel = registry.schedule(['cart'], (scheduled) => {
      work = scheduled;
      return vi.fn();
    });
    expect(loader).not.toHaveBeenCalled();
    work?.();
    await registry.preload('cart');
    expect(loader).toHaveBeenCalledTimes(1);
    cancel();
  });
});
