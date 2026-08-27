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

function pathSchema(keys: readonly string[]): ZodMiniObject<Record<string, ZodMiniString>> {
  return strictObject(Object.fromEntries(keys.map((key) => [key, string().check(minLength(1))])));
}

export function objectValue(value: unknown, code = 'CONTRACT_OBJECT_REQUIRED'): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Readonly<Record<string, unknown>>;
}
