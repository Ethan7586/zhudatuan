import { describe, expect, it, vi } from 'vitest';
import { AddressClipboardError, readAddressClipboard } from './addressClipboard';

describe('address clipboard', () => {
  it('reads clipboard text only after an explicit call', async () => {
    const readText = vi.fn().mockResolvedValue('  张三 13800138000 湖北省武汉市  ');
    await expect(readAddressClipboard({ readText })).resolves.toBe('张三 13800138000 湖北省武汉市');
    expect(readText).toHaveBeenCalledOnce();
  });

  it('turns permission rejection into the long-press paste fallback', async () => {
    await expect(readAddressClipboard({ readText: vi.fn().mockRejectedValue(new Error('NotAllowedError')) })).rejects.toMatchObject({
      code: 'denied',
      message: '请长按粘贴',
      name: 'AddressClipboardError',
    } satisfies Partial<AddressClipboardError>);
  });

  it('reports an unavailable clipboard', async () => {
    await expect(readAddressClipboard(undefined)).rejects.toMatchObject({ code: 'unavailable' });
  });
});
