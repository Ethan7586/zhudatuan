export interface QueryCodec<T> {
  readonly defaultValue: T;
  readonly decode: (value: string | null) => T;
  readonly encode: (value: unknown) => string | undefined;
}

type QuerySchema = Readonly<Record<string, QueryCodec<unknown>>>;
export type QueryValues<T extends QuerySchema> = Readonly<{ [K in keyof T]: T[K] extends QueryCodec<infer V> ? V : never }>;

export interface UrlQueryState<T extends QuerySchema> {
  readonly read: (search: URLSearchParams) => QueryValues<T>;
  readonly create: (values: Partial<QueryValues<T>>) => URLSearchParams;
  readonly patch: (search: URLSearchParams, values: Partial<QueryValues<T>>) => URLSearchParams;
  readonly reset: (search: URLSearchParams, keys?: readonly (keyof T)[]) => URLSearchParams;
}

export function defineQueryState<const T extends QuerySchema>(schema: T): UrlQueryState<T> {
  const keys = Object.freeze(Object.keys(schema) as (keyof T)[]);
  return Object.freeze({
    read(search: URLSearchParams): QueryValues<T> {
      return Object.freeze(Object.fromEntries(keys.map((key) => [key, schema[String(key)]!.decode(search.get(String(key)))]))) as QueryValues<T>;
    },
    create(values: Partial<QueryValues<T>>): URLSearchParams {
      return patchQuery(new URLSearchParams(), schema, keys, values);
    },
    patch(search: URLSearchParams, values: Partial<QueryValues<T>>): URLSearchParams {
      return patchQuery(search, schema, keys, values);
    },
    reset(search: URLSearchParams, selected: readonly (keyof T)[] = keys): URLSearchParams {
      const next = new URLSearchParams(search);
      for (const key of selected) next.delete(String(key));
      return next;
    },
  });
}

export function stringQuery(defaultValue = '', maximum = 255): QueryCodec<string> {
  return queryCodec(defaultValue, (value) => value !== null && value.length <= maximum ? value : defaultValue, (value) => typeof value === 'string' && value !== defaultValue && value.length <= maximum ? value : undefined);
}

export function optionalQuery(maximum = 2_048): QueryCodec<string | undefined> {
  return queryCodec(undefined, (value) => value !== null && value.length > 0 && value.length <= maximum ? value : undefined, (value) => typeof value === 'string' && value.length > 0 && value.length <= maximum ? value : undefined);
}

export function trimmedQuery(maximum = 128): QueryCodec<string | undefined> {
  return queryCodec(undefined, (value) => boundedTrim(value, maximum), (value) => boundedTrim(typeof value === 'string' ? value : null, maximum));
}

export function enumQuery<const T extends string>(values: readonly T[], defaultValue: T): QueryCodec<T> {
  const allowed = new Set(values);
  return queryCodec(defaultValue, (value) => allowed.has(value as T) ? value as T : defaultValue, (value) => typeof value === 'string' && value !== defaultValue && allowed.has(value as T) ? value : undefined);
}

export function optionalEnumQuery<const T extends string>(values: readonly T[]): QueryCodec<T | undefined> {
  const allowed = new Set(values);
  return queryCodec(undefined, (value) => allowed.has(value as T) ? value as T : undefined, (value) => typeof value === 'string' && allowed.has(value as T) ? value : undefined);
}

export function integerQuery<const T extends number>(defaultValue: T, allowed?: readonly number[]): QueryCodec<number> {
  const values = allowed === undefined ? undefined : new Set(allowed);
  const valid = (value: number) => Number.isSafeInteger(value) && value > 0 && (values === undefined || values.has(value));
  return queryCodec(defaultValue, (value) => {
    const parsed = Number(value);
    return value !== null && valid(parsed) ? parsed : defaultValue;
  }, (value) => typeof value === 'number' && value !== defaultValue && valid(value) ? String(value) : undefined);
}

const cursorState = defineQueryState({ cursor: optionalQuery() });

export function pageCursor(search: URLSearchParams, cursor: string | undefined): URLSearchParams {
  return cursorState.patch(search, { cursor });
}

function queryCodec<T>(defaultValue: T, decode: QueryCodec<T>['decode'], encode: QueryCodec<T>['encode']): QueryCodec<T> {
  return Object.freeze({ defaultValue, decode, encode });
}

function patchQuery<T extends QuerySchema>(search: URLSearchParams, schema: T, keys: readonly (keyof T)[], values: Partial<QueryValues<T>>): URLSearchParams {
  const next = new URLSearchParams(search);
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(values, key)) continue;
    const encoded = schema[String(key)]!.encode(values[key]);
    if (encoded === undefined) next.delete(String(key));
    else next.set(String(key), encoded);
  }
  return next;
}

function boundedTrim(value: string | null, maximum: number): string | undefined {
  const result = value?.trim();
  return result && result.length <= maximum ? result : undefined;
}
