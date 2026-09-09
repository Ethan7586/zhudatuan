import { describe, expect, it, vi } from 'vitest';
import { OrderMedia } from './OrderMedia';

describe('OrderMedia', () => {
  it('resolves immutable OSS references once and never exposes storage metadata', async () => {
    const link = vi.fn(async () => ({ url: 'https://assets.example/signed/gift.webp', expiresAt: '2026-09-10T03:00:00.000Z' }));
    const media = new OrderMedia({ link });

    const rows = await media.orders([
      {
        id: 'order:one',
        lines: [
          { id: 'line:one', imageReference: 'object:catalog:gift', imageUrl: null },
          { id: 'line:two', imageReference: 'object:catalog:gift', imageUrl: '/products/fallback.webp' },
        ],
      },
    ]);

    expect(link).toHaveBeenCalledExactlyOnceWith('object:catalog:gift');
    expect(rows[0]?.lines).toEqual([
      { id: 'line:one', image: 'https://assets.example/signed/gift.webp' },
      { id: 'line:two', image: 'https://assets.example/signed/gift.webp' },
    ]);
  });

  it('falls back safely for legacy snapshots and rejects executable URLs', async () => {
    const media = new OrderMedia({ link: vi.fn(async () => Promise.reject(new Error('OBJECT_UNAVAILABLE'))) });

    const rows = await media.lines([
      { id: 'line:one', imageReference: 'object:missing', imageUrl: '/products/legacy.webp' },
      { id: 'line:two', imageReference: null, imageUrl: 'javascript:alert(1)' },
      { id: 'line:three', imageReference: null, imageUrl: 'https://user:secret@assets.example/private.webp' },
    ]);

    expect(rows).toEqual([
      { id: 'line:one', image: '/products/legacy.webp' },
      { id: 'line:two', image: null },
      { id: 'line:three', image: null },
    ]);
  });
});
