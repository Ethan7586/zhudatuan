export function toggleSelection<T>(current: ReadonlySet<T>, key: T): ReadonlySet<T> {
  const next = new Set(current);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

export function visibleSelection<T extends Readonly<{ id: string }>>(rows: readonly T[], selected: ReadonlySet<string>): ReadonlySet<string> {
  return new Set(rows.filter((row) => selected.has(row.id)).map((row) => row.id));
}
