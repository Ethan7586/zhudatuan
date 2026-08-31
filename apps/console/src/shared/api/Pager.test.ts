// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { collectPages } from './Pager';

describe('collectPages', () => {
  it('collects every cursor page in order', async () => {
    const read = vi.fn((cursor: string | undefined) => Promise.resolve(cursor === undefined ? { items: ['one'], nextCursor: 'next' } : { items: ['two'] }));
    await expect(collectPages(read)).resolves.toEqual(['one', 'two']);
    expect(read).toHaveBeenNthCalledWith(1, undefined);
    expect(read).toHaveBeenNthCalledWith(2, 'next');
  });

  it('fails closed on a repeated cursor or an excessive number of pages', async () => {
    await expect(collectPages(() => Promise.resolve({ items: [], nextCursor: 'same' }))).rejects.toThrow('PAGE_CURSOR_REPEATED');
    await expect(collectPages((cursor) => Promise.resolve({ items: [], nextCursor: cursor === undefined ? 'one' : 'two' }), 1)).rejects.toThrow('PAGE_LIMIT_EXCEEDED');
  });
});
