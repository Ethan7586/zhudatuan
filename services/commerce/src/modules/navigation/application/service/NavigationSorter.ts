export function sortNavigation<T extends Readonly<{ key: string; order: number }>>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values].sort((left, right) => left.order - right.order || left.key.localeCompare(right.key)));
}
