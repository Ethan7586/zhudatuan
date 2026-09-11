import {
  array,
  boolean,
  lazy,
  minLength,
  null as nullSchema,
  number,
  optional,
  record,
  strictObject,
  string,
  union,
  undefined as undefinedSchema,
  type ZodMiniObject,
  type ZodMiniString,
  type ZodMiniType,
} from 'zod/mini';

export type ContractJsonScalar = string | number | boolean | null;
export type ContractJsonValue = ContractJsonScalar | ContractJsonObject | readonly ContractJsonValue[];
export interface ContractJsonObject { readonly [key: string]: ContractJsonValue }
export type Schema<T> = ZodMiniType<T>;
export type SchemaOutput<TSchema> = TSchema extends Schema<infer TOutput> ? TOutput : never;

export type OperationQueryValue = string | number | boolean | readonly string[] | null | undefined;
export type OperationQuery = Readonly<Record<string, OperationQueryValue>>;
type PathInput<TKey extends string> = [TKey] extends [never]
  ? Readonly<{ path?: never }>
  : Readonly<{ path: Readonly<Record<TKey, string>> }>;

export type StructuralOperationInput<TKey extends string = never> = PathInput<TKey> & Readonly<{
  query?: OperationQuery;
  body?: ContractJsonValue;
}>;

export const ContractJsonValueSchema: Schema<ContractJsonValue> = lazy(() => union([
  string(),
  number(),
  boolean(),
  nullSchema(),
  array(ContractJsonValueSchema),
  record(string(), ContractJsonValueSchema),
]));

const queryValueSchema: Schema<OperationQueryValue> = union([
  string(),
  number(),
  boolean(),
  array(string()),
  nullSchema(),
  undefinedSchema(),
]);

export function structuralOperationInput<const TKeys extends readonly string[]>(
  pathKeys: TKeys,
): Schema<StructuralOperationInput<TKeys[number]>> {
  const shared = {
    query: optional(record(string(), queryValueSchema)),
    body: optional(ContractJsonValueSchema),
  };
  const value = pathKeys.length === 0
    ? strictObject(shared)
    : strictObject({ path: pathSchema(pathKeys), ...shared });
  return value as unknown as Schema<StructuralOperationInput<TKeys[number]>>;
}

export function structuralOperationOutput(): Schema<ContractJsonValue | undefined> {
  return optional(ContractJsonValueSchema);
}

declare const schemaNameBrand: unique symbol;
export type NamedContractObject<TName extends string = string> = ContractJsonObject & Readonly<{
  [schemaNameBrand]?: TName;
}>;

export type NamedOperationInput<TKey extends string = never, TName extends string = string> = PathInput<TKey> & Readonly<{
  query?: OperationQuery;
  body?: NamedContractObject<TName>;
}>;

export function namedOperationInput<const TKeys extends readonly string[], const TName extends string>(
  pathKeys: TKeys,
  name: TName,
  bodyFields: readonly string[] | null,
): Schema<NamedOperationInput<TKeys[number], TName>> {
  const structural = structuralOperationInput(pathKeys);
  return parser((value) => {
    const parsed = structural.parse(value) as StructuralOperationInput<TKeys[number]>;
    if (parsed.body === undefined) return parsed as NamedOperationInput<TKeys[number], TName>;
    const body = namedJsonObject(parsed.body, name, bodyFields);
    return Object.freeze({ ...parsed, body }) as NamedOperationInput<TKeys[number], TName>;
  });
}

export function namedOperationOutput<const TName extends string>(
  name: TName,
  fields: readonly string[] | null,
): Schema<NamedContractObject<TName> | undefined> {
  return parser((value) => value === undefined ? undefined : namedJsonObject(value, name, fields));
}

function namedJsonObject<const TName extends string>(value: unknown, name: TName,
  fields: readonly string[] | null): NamedContractObject<TName> {
  if (!isPlainObject(value)) throw new Error(`CONTRACT_OBJECT_REQUIRED:${name}`);
  const allowed = fields === null ? null : new Set(fields);
  const normalized = normalizeJson(value, name, allowed) as ContractJsonObject;
  return Object.freeze(normalized) as NamedContractObject<TName>;
}

function normalizeJson(value: unknown, path: string, allowed: ReadonlySet<string> | null = null): ContractJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new Error(`CONTRACT_DATE_INVALID:${path}`);
    return value.toISOString();
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`CONTRACT_NUMBER_NON_FINITE:${path}`);
    return value;
  }
  if (Array.isArray(value)) return Object.freeze(value.map((item, index) => normalizeJson(item, `${path}[${index}]`)));
  if (!isPlainObject(value)) throw new Error(`CONTRACT_VALUE_INVALID:${path}`);
  const result: Record<string, ContractJsonValue> = {};
  for (const [key, child] of Object.entries(value)) {
    if (allowed !== null && !allowed.has(key)) throw new Error(`CONTRACT_FIELD_UNDECLARED:${path}:${key}`);
    if (dateField(key) && child !== null && (typeof child !== 'string' || !validDate(child))) {
      throw new Error(`CONTRACT_DATE_INVALID:${path}:${key}`);
    }
    result[key] = normalizeJson(child, `${path}.${key}`);
  }
  return Object.freeze(result);
}

function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function dateField(key: string): boolean {
  return /(?:^|_)(?:date|time|at)$/.test(key) || /(?:Date|Time|At)$/.test(key);
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)
    && Number.isFinite(Date.parse(value.length === 10 ? `${value}T00:00:00Z` : value));
}

function parser<T>(parse: (value: unknown) => T): Schema<T> {
  return Object.freeze({ parse }) as unknown as Schema<T>;
}

function pathSchema(keys: readonly string[]): ZodMiniObject<Record<string, ZodMiniString>> {
  return strictObject(Object.fromEntries(keys.map((key) => [key, string().check(minLength(1))])));
}

export function objectValue(value: unknown, code = 'CONTRACT_OBJECT_REQUIRED'): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Readonly<Record<string, unknown>>;
}
