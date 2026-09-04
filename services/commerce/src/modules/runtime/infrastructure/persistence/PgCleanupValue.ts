import type { CleanupBatch } from '../../application/port/CleanupPort';

export function cleanupLimit(limit: number): void {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 5000) throw new Error('CLEANUP_LIMIT_INVALID');
}

export function cleanupBatch(
  rows: readonly Readonly<{ id: string; object_key: string | null; error_report_key?: string | null }>[],
  prefix: 'import:' | 'export:'
): CleanupBatch {
  const ids = rows.map(({ id }) => id);
  const objects = [...new Set(rows.flatMap(({ object_key: object, error_report_key: report }) => [object, report]
    .filter((reference): reference is string => reference !== null && reference !== undefined)))];
  if (ids.length > 5000 || new Set(ids).size !== ids.length || ids.some((id) => typeof id !== 'string' || !id.startsWith(prefix))) {
    throw new Error('CLEANUP_TASK_SET_INVALID');
  }
  if (objects.some((reference) => reference.length < 3)) throw new Error('CLEANUP_OBJECT_SET_INVALID');
  return Object.freeze({ ids: Object.freeze(ids), objects: Object.freeze(objects) });
}

export function cleanupIds(ids: readonly string[], prefix?: 'import:' | 'export:' | 'job:' | 'deadletter:'): readonly string[] {
  if (ids.length > 5000 || new Set(ids).size !== ids.length || ids.some((id) => typeof id !== 'string' || id.length < 3 || prefix !== undefined && !id.startsWith(prefix))) {
    throw new Error('CLEANUP_TASK_SET_INVALID');
  }
  return Object.freeze([...ids]);
}
