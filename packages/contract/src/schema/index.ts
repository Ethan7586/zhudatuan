import { array, boolean, discriminatedUnion, literal, minLength, null as nullSchema, number, optional, strictObject, string, union, type ZodMiniObject, type ZodMiniString, type ZodMiniType } from 'zod/mini';
import { OPERATION_BODY_SCHEMAS, OPERATION_OUTPUT_SCHEMAS, OPERATION_QUERY_SCHEMAS } from './SchemaCatalog';
import { IDENTITY_BODY_SCHEMAS, IDENTITY_QUERY_SCHEMAS } from './IdentityInputSchema';

export type { ContractJsonObject, ContractJsonValue, ContractJsonScalar } from './JsonSchema';
import type { ContractJsonValue } from './JsonSchema';
export { ContractJsonValueSchema } from './JsonSchema';
export type Schema<T> = ZodMiniType<T>;
export type SchemaOutput<TSchema> = TSchema extends Schema<infer TOutput> ? TOutput : never;

export type OperationQueryValue = string | number | boolean | readonly string[] | null | undefined;
export type OperationQuery = Readonly<Record<string, OperationQueryValue>>;
type PathInput<TKey extends string> = [TKey] extends [never] ? Readonly<{ path?: never }> : Readonly<{ path: Readonly<Record<TKey, string>> }>;

export type ExactOperationInput<TKey extends string = never> = PathInput<TKey> &
  Readonly<{
    query?: OperationQuery;
    body?: ContractJsonValue;
  }>;

export function exactOperationInput<const TKeys extends readonly string[]>(schemaName: string, pathKeys: TKeys, bodyRequired: boolean): Schema<ExactOperationInput<TKeys[number]>> {
  const shared = bodyRequired ? { body: operationBody(schemaName) } : { query: optional(operationQuery(schemaName)) };
  const value = pathKeys.length === 0 ? strictObject(shared) : strictObject({ path: pathSchema(pathKeys), ...shared });
  return value as unknown as Schema<ExactOperationInput<TKeys[number]>>;
}

const operationOutputSchemas = OPERATION_OUTPUT_SCHEMAS;

type KnownOperationOutputName = keyof typeof operationOutputSchemas;
type OperationOutputSchema<TName extends string> = TName extends KnownOperationOutputName ? (typeof operationOutputSchemas)[TName] : never;

function operationBody(schemaName: string): Schema<ContractJsonValue> {
  const schema = definedOperationBodySchema(schemaName);
  if (!schema) throw new Error(`CONTRACT_BODY_SCHEMA_MISSING:${schemaName}`);
  return schema;
}

export function definedOperationBodySchema(schemaName: string): Schema<ContractJsonValue> | undefined {
  const empty = strictObject({});
  const schemas: Readonly<Record<string, Schema<ContractJsonValue>>> = {
    ...(IDENTITY_BODY_SCHEMAS as Readonly<Record<string, Schema<ContractJsonValue>>>),
    AccessOwnersTransferInput: strictObject({ targetMembership: string(), targetVersion: number(), reason: string() }),
    AccessRolesManageInput: strictObject({ name: string(), allows: array(string()), denies: array(string()) }),
    AccessOverridesManageInput: discriminatedUnion('action', [
      strictObject({ action: literal('set'), targetMembership: string(), permission: string(), effect: literal(['allow', 'deny']), expiresAt: optional(string()), reason: string() }),
      strictObject({ action: literal('revoke'), targetMembership: string(), permission: string(), reason: string() }),
    ]) as Schema<ContractJsonValue>,
    AccessScopesManageInput: strictObject({ targetMembership: string(), kind: string(), scope: string(), effect: optional(literal(['allow', 'deny'])), expiresAt: optional(string()) }) as Schema<ContractJsonValue>,
    CapabilityAssignmentsManageInput: strictObject({ capability: string(), state: literal(['enabled', 'disabled']), quota: optional(number()), expiresAt: optional(string()) }) as Schema<ContractJsonValue>,
    OrganizationDirectoriesManageInput: strictObject({
      providerid: string(),
      providertype: literal(['wecomcorp', 'wecomsuite']),
      status: literal(['draft', 'enabled', 'paused', 'disabled', 'revoked']),
      secretref: string(),
      organizationid: string(),
    }),
    OrganizationDirectoriesSyncInput: strictObject({ mode: optional(literal(['full', 'incremental'])) }) as Schema<ContractJsonValue>,
    OrganizationDirectoryeventsReceiveInput: empty,
    VoucherCardlibrariesCreateInput: discriminatedUnion('mode', [
      strictObject({ mode: literal('generated'), prefix: string(), provider: optional(union([string(), nullSchema()])) }),
      strictObject({ mode: literal('imported'), prefix: string(), provider: optional(union([string(), nullSchema()])), objectRef: string(), sha256: string() }),
    ]) as Schema<ContractJsonValue>,
    ...(OPERATION_BODY_SCHEMAS as Readonly<Record<string, Schema<ContractJsonValue>>>),
  };
  return schemas[schemaName];
}

function operationQuery(schemaName: string): Schema<OperationQuery> {
  const schema = definedOperationQuerySchema(schemaName);
  if (!schema) throw new Error(`CONTRACT_QUERY_SCHEMA_MISSING:${schemaName}`);
  return schema;
}

export function definedOperationQuerySchema(schemaName: string): Schema<OperationQuery> | undefined {
  const page = { limit: optional(union([string(), number()])), cursor: optional(string()) };
  const empty = strictObject({});
  const schemas: Readonly<Record<string, Schema<OperationQuery>>> = {
    ...(IDENTITY_QUERY_SCHEMAS as Readonly<Record<string, Schema<OperationQuery>>>),
    OrganizationLayersReadInput: strictObject(page),
    AccessCenterReadInput: strictObject(page),
    CapabilityAssignmentsReadInput: strictObject(page),
    NavigationTreeReadInput: strictObject({ scopeid: optional(string()) }),
    NavigationCatalogReadInput: empty,
    NavigationHealthReadInput: empty,
    OrganizationDirectoriesReadInput: strictObject(page),
    OrganizationDirectoriesSyncrunsReadInput: strictObject(page),
    ...(OPERATION_QUERY_SCHEMAS as Readonly<Record<string, Schema<OperationQuery>>>),
  };
  return schemas[schemaName];
}

export function exactOperationOutput<const TName extends string>(schemaName: TName): OperationOutputSchema<TName> {
  const known = definedOperationOutputSchema(schemaName);
  if (!known) throw new Error(`CONTRACT_OUTPUT_SCHEMA_MISSING:${schemaName}`);
  return known as OperationOutputSchema<TName>;
}

export function definedOperationOutputSchema(schemaName: string): Schema<ContractJsonValue> | undefined {
  return Reflect.get(operationOutputSchemas, schemaName) as Schema<ContractJsonValue> | undefined;
}

function pathSchema(keys: readonly string[]): ZodMiniObject<Record<string, ZodMiniString>> {
  return strictObject(Object.fromEntries(keys.map((key) => [key, string().check(minLength(1))])));
}

export function objectValue(value: unknown, code = 'CONTRACT_OBJECT_REQUIRED'): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Readonly<Record<string, unknown>>;
}
