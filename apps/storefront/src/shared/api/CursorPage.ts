export interface CursorPage {
  readonly nextCursor?: string | null;
}

export async function readCursorPages<TPage extends CursorPage>(read: (cursor: string | null) => Promise<TPage>, signal?: AbortSignal): Promise<readonly TPage[]> {
  const pages: TPage[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  while (true) {
    signal?.throwIfAborted();
    const page = await read(cursor);
    signal?.throwIfAborted();
    pages.push(page);
    const next = page.nextCursor ?? null;
    if (next === null) return Object.freeze(pages);
    if (seen.has(next)) throw new Error('CURSOR_CYCLE_DETECTED');
    seen.add(next);
    cursor = next;
  }
}
