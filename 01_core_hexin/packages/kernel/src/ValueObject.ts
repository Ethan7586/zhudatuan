export abstract class ValueObject<T extends Readonly<Record<string, unknown>>> {
  readonly value: T;

  protected constructor(value: T) {
    this.value = Object.freeze({ ...value });
  }

  equals(other: ValueObject<T> | undefined): boolean {
    return other !== undefined && canonical(this.value) === canonical(other.value);
  }
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
