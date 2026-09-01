import { array, boolean, discriminatedUnion, literal, minLength, null as nullSchema, number, optional, strictObject, string, union, type ZodMiniObject, type ZodMiniString, type ZodMiniType } from 'zod/mini';
import { OPERATION_BODY_SCHEMAS, OPERATION_OUTPUT_SCHEMAS, OPERATION_QUERY_SCHEMAS } from './SchemaCatalog';

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
  const target = literal(['console', 'storefront']);
  const returnTarget = string();
  const authorization = strictObject({ state: string(), nonce: string(), challenge: string() });
  const empty = strictObject({});
  const schemas: Readonly<Record<string, Schema<ContractJsonValue>>> = {
    IdentitySessionsCreateInput: discriminatedUnion('method', [
      strictObject({ method: literal('password'), subject: string(), password: string(), target, returnTarget, authorization }),
      strictObject({ method: literal('otp'), subject: string(), challenge: string(), code: string(), target, returnTarget, authorization }),
      strictObject({ method: literal('invitation'), code: string(), target, returnTarget, authorization }),
      strictObject({ method: literal('federation'), provider: string(), target, returnTarget, authorization }),
    ]) as Schema<ContractJsonValue>,
    IdentitySessionsCompleteInput: strictObject({ code: string(), proof: string(), returnTarget, authorization }),
    IdentityTicketsExchangeInput: strictObject({ ticket: string(), state: string(), nonce: string(), verifier: string(), returnTarget }),
    IdentitySessionDeleteInput: empty,
    IdentitySessionsRevokeInput: empty,
    IdentityMembershipsSwitchInput: strictObject({ membershipId: string() }),
    IdentityChallengesCreateInput: strictObject({ purpose: literal(['login', 'password_reset', 'enrollment']), destination: string() }),
    IdentityMobileChallengesCreateInput: strictObject({ destination: string() }),
    IdentityInvitationsResolveInput: strictObject({ code: string(), target }),
    IdentityInvitationsCreateInput: strictObject({
      kind: literal(['signin', 'enrollment', 'campaign']),
      target,
      membershipId: optional(string()),
      organizationId: optional(string()),
      recipient: optional(string()),
      expiresAt: string(),
      maxUses: optional(number()),
      reason: string(),
    }) as Schema<ContractJsonValue>,
    IdentityInvitationsRevokeInput: strictObject({ reason: string() }),
    IdentityEnrollmentsCompleteInput: strictObject({ subject: string(), challenge: string(), code: string(), termsAccepted: boolean(), termsHash: string(), password: string(), displayName: string(), authorization }),
    IdentityMembersManageInput: discriminatedUnion('action', [
      strictObject({ action: literal('update'), displayName: string(), departmentId: optional(string()), reason: string() }),
      strictObject({ action: literal('status'), status: literal(['active', 'suspended', 'offboarded', 'left']), reason: string() }),
    ]) as Schema<ContractJsonValue>,
    IdentityPasswordChangeInput: strictObject({ currentPassword: string(), newPassword: string() }),
    IdentityPasswordVerifyInput: strictObject({ password: string() }),
    IdentityPasswordResetInput: strictObject({ challenge: string(), code: string(), newPassword: string() }),
    IdentityMobileManageInput: strictObject({ mobile: string(), challenge: string(), code: string() }),
    IdentityStepupStartInput: strictObject({
      action: optional(
        strictObject({
          operation: string(),
          resource: string(),
          requestHash: string(),
          expectedVersion: number(),
          makerMembership: string(),
        })
      ),
    }) as Schema<ContractJsonValue>,
    IdentityStepupCompleteInput: strictObject({ challenge: string(), code: string() }),
    IdentityFederationsStartInput: strictObject({ providerid: string(), returntarget: string(), authorization }),
    IdentityFederationsCompleteInput: strictObject({ membershipid: string() }),
    IdentityLinksCreateInput: strictObject({ providerid: string(), returntarget: string(), authorization }),
    IdentityLinksRevokeInput: empty,
    IdentityProvidersManageInput: strictObject({
      type: literal(['wechat', 'wecomcorp', 'wecomsuite', 'oidc']),
      issuer: union([string(), nullSchema()]),
      scopes: array(string()),
      status: literal(['draft', 'enabled', 'disabled', 'revoked']),
      clientid: string(),
      secretref: string(),
    }),
    IdentityProvidersTestInput: empty,
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
    IdentitySessionReadInput: empty,
    IdentitySessionsReadInput: strictObject(page),
    IdentityMembershipsReadInput: empty,
    IdentityInvitationsReadInput: strictObject({
      ...page,
      target: optional(literal(['console', 'storefront'])),
      kind: optional(literal(['signin', 'enrollment', 'campaign'])),
      status: optional(literal(['draft', 'active', 'exhausted', 'revoked', 'expired'])),
    }),
    IdentityEnrollmentsReadInput: empty,
    IdentityProvidersReadInput: strictObject({ returntarget: optional(string()), returnpath: optional(string()) }),
    IdentityFederationsCallbackInput: strictObject({ state: string(), code: string() }),
    IdentityFederationsSelectionReadInput: empty,
    IdentityLinksReadInput: empty,
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
