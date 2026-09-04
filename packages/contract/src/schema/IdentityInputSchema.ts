import { array, discriminatedUnion, literal, minLength, null as nullSchema, number, optional, strictObject, string, union, type ZodMiniObject, type ZodMiniString, type ZodMiniType } from 'zod/mini';
import type { ContractJsonValue } from './JsonSchema';

const target = literal(['console', 'storefront']);
const returnTarget = string();
const authorization = strictObject({ state: string(), nonce: string(), challenge: string() });
const empty = strictObject({});
const page = { limit: optional(union([string(), number()])), cursor: optional(string()) };

export const IDENTITY_BODY_SCHEMAS = Object.freeze({
  IdentitySessionsCreateInput: discriminatedUnion('method', [
    strictObject({ method: literal('password'), subject: string(), password: string(), target, returnTarget, authorization }),
    strictObject({ method: literal('otp'), subject: string(), challenge: string(), code: string(), target, returnTarget, authorization }),
    strictObject({ method: literal('federation'), provider: string(), target, returnTarget, authorization }),
  ]),
  IdentitySessionsCompleteInput: strictObject({ code: string(), proof: string(), returnTarget, authorization }),
  IdentityTicketsExchangeInput: strictObject({ ticket: string(), state: string(), nonce: string(), verifier: string(), returnTarget }),
  IdentitySessionDeleteInput: empty,
  IdentitySessionsRevokeInput: empty,
  IdentityMembershipsSwitchInput: strictObject({ membershipId: string() }),
  IdentityChallengesCreateInput: discriminatedUnion('purpose', [
    strictObject({ purpose: literal('login'), destination: string() }),
    strictObject({ purpose: literal('password_reset'), destination: string() }),
    strictObject({ purpose: literal('enrollment'), enrollmentId: string() }),
    strictObject({ purpose: literal('enrollment_campaign'), enrollmentId: string(), destination: string() }),
  ]),
  IdentityMobileChallengesCreateInput: strictObject({ destination: string() }),
  IdentityInvitationsResolveInput: strictObject({ code: string(), target, returnTarget, authorization }),
  IdentityInvitationsCreateInput: discriminatedUnion('kind', [
    strictObject({ kind: literal('enrollment'), target: literal('storefront'), organizationId: string(), employee: strictObject({ displayName: string(), mobile: string(), employeeNo: optional(string()), departmentId: optional(string()) }), expiresAt: string(), reason: string() }),
    strictObject({ kind: literal('campaign'), target: literal('storefront'), organizationId: string(), maxUses: number(), expiresAt: string(), reason: string() }),
    strictObject({ kind: literal('signin'), target, membershipId: string(), expiresAt: string(), reason: string() }),
  ]),
  IdentityInvitationsRevokeInput: strictObject({ reason: string() }),
  IdentityEnrollmentsCompleteInput: discriminatedUnion('mode', [
    strictObject({ mode: literal('bound'), challenge: string(), code: string(), termsAccepted: literal(true), termsHash: string(), password: string(), displayName: optional(string()), authorization }),
    strictObject({ mode: literal('campaign'), subject: string(), challenge: string(), code: string(), termsAccepted: literal(true), termsHash: string(), password: string(), displayName: string(), authorization }),
  ]),
  IdentityMembersManageInput: discriminatedUnion('action', [
    strictObject({ action: literal('update'), displayName: string(), departmentId: optional(string()), reason: string() }),
    strictObject({ action: literal('status'), status: literal(['active', 'suspended', 'offboarded', 'left']), reason: string() }),
  ]),
  IdentityPasswordChangeInput: strictObject({ currentPassword: string(), newPassword: string() }),
  IdentityPasswordVerifyInput: strictObject({ password: string() }),
  IdentityPasswordResetInput: strictObject({ challenge: string(), code: string(), newPassword: string() }),
  IdentityMobileManageInput: strictObject({ mobile: string(), challenge: string(), code: string() }),
  IdentityStepupStartInput: strictObject({ action: optional(strictObject({ operation: string(), resource: string(), requestHash: string(), expectedVersion: number(), makerMembership: string() })) }),
  IdentityStepupCompleteInput: strictObject({ challenge: string(), code: string() }),
  IdentityStepupDisableInput: empty,
  IdentityFederationsStartInput: strictObject({ providerid: string(), returntarget: string(), authorization }),
  IdentityFederationsCompleteInput: strictObject({ membershipid: string() }),
  IdentityLinksCreateInput: strictObject({ providerid: string(), returntarget: string(), authorization }),
  IdentityLinksRevokeInput: empty,
  IdentityProvidersManageInput: strictObject({ type: literal(['wechat', 'wecomcorp', 'wecomsuite', 'oidc']), issuer: union([string(), nullSchema()]), scopes: array(string()), status: literal(['draft', 'enabled', 'disabled', 'revoked']), clientid: string(), secretref: string() }),
  IdentityProvidersTestInput: empty,
} as const);

export const IDENTITY_QUERY_SCHEMAS = Object.freeze({
  IdentitySessionReadInput: empty,
  IdentitySessionsReadInput: strictObject(page),
  IdentityMembershipsReadInput: empty,
  IdentityInvitationsReadInput: strictObject({ ...page, target: optional(target), kind: optional(literal(['signin', 'enrollment', 'campaign'])), status: optional(literal(['draft', 'active', 'exhausted', 'revoked', 'expired'])) }),
  IdentityEnrollmentsReadInput: empty,
  IdentityBootstrapReadInput: strictObject({ returntarget: optional(string()), returnpath: optional(string()) }),
  IdentityProvidersReadInput: strictObject({ returntarget: optional(string()) }),
  IdentityProvidersCenterReadInput: empty,
  IdentityFederationsCallbackInput: strictObject({ state: string(), code: string() }),
  IdentityFederationsSelectionReadInput: empty,
  IdentityLinksReadInput: empty,
} as const);

export function identityInputSchema(schemaName: string, pathKeys: readonly string[], bodyRequired: boolean): ZodMiniType {
  const catalog = (bodyRequired ? IDENTITY_BODY_SCHEMAS : IDENTITY_QUERY_SCHEMAS) as unknown as Readonly<Record<string, unknown>>;
  const schema: unknown = catalog[schemaName];
  if (!isSchema(schema)) throw new Error(`IDENTITY_INPUT_SCHEMA_MISSING:${schemaName}`);
  const shared = bodyRequired ? { body: schema } : { query: optional(schema) };
  return pathKeys.length === 0 ? strictObject(shared) : strictObject({ path: pathSchema(pathKeys), ...shared });
}

function isSchema(value: unknown): value is ZodMiniType<ContractJsonValue> {
  return typeof value === 'object' && value !== null && 'parse' in value;
}

function pathSchema(keys: readonly string[]): ZodMiniObject<Record<string, ZodMiniString>> {
  const shape: Record<string, ZodMiniString> = {};
  for (const key of keys) shape[key] = string().check(minLength(1));
  return strictObject(shape);
}
