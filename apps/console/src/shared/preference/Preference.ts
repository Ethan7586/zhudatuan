export interface PreferenceAddress {
  readonly actor: string;
  readonly membership: string;
  readonly scope: Readonly<{ kind: string; id: string }>;
  readonly view: string;
  readonly name: string;
}

export interface PreferenceCodec<Value> {
  readonly version: number;
  readonly fallback: Value;
  parse(value: unknown): Value;
  serialize(value: Value): unknown;
}

export function preferenceKey(address: PreferenceAddress): string {
  return [address.actor, address.membership, address.scope.kind, address.scope.id, address.view, address.name].map(encodeURIComponent).join('|');
}

export function stringListPreference<const Value extends string>(allowed: readonly Value[], fallback: readonly Value[]): PreferenceCodec<readonly Value[]> {
  const accepted = new Set<string>(allowed);
  const safeFallback = Object.freeze([...new Set(fallback.filter((item) => accepted.has(item)))]);
  return Object.freeze({
    version: 1,
    fallback: safeFallback,
    parse: (value: unknown) => {
      if (!Array.isArray(value)) return safeFallback;
      const selected = value.filter((item): item is Value => typeof item === 'string' && accepted.has(item));
      return Object.freeze([...new Set(selected)]);
    },
    serialize: (value: readonly Value[]) => [...new Set(value.filter((item) => accepted.has(item)))],
  });
}
