export interface Page<T> {
  readonly items: readonly T[];
  readonly next: string | null;
  readonly total?: number;
}

export function page<T>(items: readonly T[], next: string | null, total?: number): Page<T> {
  if (!Number.isSafeInteger(items.length)) throw new Error('PAGE_INVALID');
  return Object.freeze({ items: Object.freeze([...items]), next, ...(total === undefined ? {} : { total }) });
}
