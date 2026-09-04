import type { ClientPage } from '@shop/contract/client';

export async function collectPages<T>(read: (cursor: string | undefined) => Promise<ClientPage<T>>, maximumPages = 100): Promise<readonly T[]> {
  if (!Number.isSafeInteger(maximumPages) || maximumPages < 1) throw new Error('PAGE_LIMIT_INVALID');
  const items: T[] = [];
  const cursors = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < maximumPages; page += 1) {
    const result = await read(cursor);
    items.push(...result.items);
    if (result.nextCursor === undefined) return Object.freeze(items);
    if (cursors.has(result.nextCursor)) throw new Error('PAGE_CURSOR_REPEATED');
    cursors.add(result.nextCursor);
    cursor = result.nextCursor;
  }
  throw new Error('PAGE_LIMIT_EXCEEDED');
}
