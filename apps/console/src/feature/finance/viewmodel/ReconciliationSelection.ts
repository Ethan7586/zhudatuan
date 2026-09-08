export function toggleSelection<T>(current: ReadonlySet<T>, value: T): ReadonlySet<T> {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function togglePageSelection(current: ReadonlySet<string>, ids: readonly string[]): ReadonlySet<string> {
  const next = new Set(current);
  const all = ids.every((id) => next.has(id));
  for (const id of ids) {
    if (all) next.delete(id);
    else next.add(id);
  }
  return next;
}
