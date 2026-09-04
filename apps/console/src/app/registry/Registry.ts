export interface RegistryEntry<TKey extends string> {
  readonly id: TKey;
}

export interface RegistryPort<TKey extends string, TEntry extends RegistryEntry<TKey>> {
  all(): readonly TEntry[];
  get(id: TKey): TEntry;
  has(id: string): id is TKey;
}

export function createRegistry<TKey extends string, TEntry extends RegistryEntry<TKey>>(
  entries: readonly TEntry[],
  expected: readonly TKey[],
  name: string
): RegistryPort<TKey, TEntry> {
  const expectedIds = new Set(expected);
  if (expectedIds.size !== expected.length) throw new Error(`${name}_REGISTRY_EXPECTATION_DUPLICATE`);
  const values = entries.map(immutable);
  const byId = new Map<TKey, TEntry>();
  for (const entry of values) {
    if (byId.has(entry.id)) throw new Error(`${name}_REGISTRY_DUPLICATE:${entry.id}`);
    byId.set(entry.id, entry);
  }
  for (const id of expectedIds) if (!byId.has(id)) throw new Error(`${name}_REGISTRY_MISSING:${id}`);
  if (byId.size !== expected.length) throw new Error(`${name}_REGISTRY_UNKNOWN`);
  const all = Object.freeze(values);
  return Object.freeze({
    all: () => all,
    get(id: TKey) {
      const entry = byId.get(id);
      if (entry === undefined) throw new Error(`${name}_REGISTRY_MISSING:${id}`);
      return entry;
    },
    has: (id: string): id is TKey => byId.has(id as TKey),
  });
}

function immutable<T>(value: T): T {
  if (Array.isArray(value)) return Object.freeze(value.map(immutable)) as T;
  if (value !== null && typeof value === 'object') {
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, immutable(child)]))) as T;
  }
  return value;
}
