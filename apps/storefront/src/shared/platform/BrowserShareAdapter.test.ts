import { describe, expect, it, vi } from 'vitest';
import { BrowserShareAdapter } from './BrowserShareAdapter';

const content = Object.freeze({ title: '福利商品', text: '为你推荐', url: 'https://shop.example.com/s/acme/products/one' });

describe('BrowserShareAdapter', () => {
  it('uses the native share capability when the current browser provides it', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };

    await expect(new BrowserShareAdapter({ share, clipboard }).share(content)).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith(content);
    expect(clipboard.writeText).not.toHaveBeenCalled();
  });

  it('copies the authoritative link when native sharing is unavailable', async () => {
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };

    await expect(new BrowserShareAdapter({ clipboard }).share(content)).resolves.toBe('copied');
    expect(clipboard.writeText).toHaveBeenCalledWith(content.url);
  });

  it('fails explicitly instead of showing a preview when no real capability exists', async () => {
    await expect(new BrowserShareAdapter({}).share(content)).rejects.toThrow('SHARE_UNAVAILABLE');
  });
});
