export function sortNavigation<T extends Readonly<{ id: string; order: number }>>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id)));
}
