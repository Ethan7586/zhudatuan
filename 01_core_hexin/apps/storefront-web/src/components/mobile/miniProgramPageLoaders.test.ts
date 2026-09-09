import { describe, expect, it } from 'vitest';
import { loadMPCartPage, preloadMiniProgramPage } from './miniProgramPageLoaders';

describe('mini-program page preload adapter', () => {
  it('shares one promise between intent preload and actual page load', async () => {
    preloadMiniProgramPage('cart');
    const first = loadMPCartPage();
    const second = loadMPCartPage();
    expect(first).toBe(second);
    await expect(first).resolves.toHaveProperty('MPCartPage');
  });

  it('ignores pages without a preload target', () => {
    expect(() => preloadMiniProgramPage('home')).not.toThrow();
  });
});
