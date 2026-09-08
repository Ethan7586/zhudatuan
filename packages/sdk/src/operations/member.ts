// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInputFrom, exactOperationOutputFrom } from '@shop/contract/operationschema';
import { MEMBER_QUERY_SCHEMAS, MEMBER_BODY_SCHEMAS, MEMBER_OUTPUT_SCHEMAS } from '@shop/contract/schema/Member';
import { defineOperation } from '../CatalogOperationDescriptor';

export const MEMBER_OPERATION_IDS = Object.freeze([
  "member.members.read",
  "member.profile.read",
  "member.addresses.read",
  "member.addresses.manage",
  "member.favorites.read",
  "member.favorites.put",
  "member.imports.create",
  "member.imports.read",
] as const satisfies readonly OperationId[]);

export interface MemberOperations {
  readonly membersRead: OperationMethod<"member.members.read">;
  readonly profileRead: OperationMethod<"member.profile.read">;
  readonly addressesRead: OperationMethod<"member.addresses.read">;
  readonly addressesManage: OperationMethod<"member.addresses.manage">;
  readonly favoritesRead: OperationMethod<"member.favorites.read">;
  readonly favoritesPut: OperationMethod<"member.favorites.put">;
  readonly importsCreate: OperationMethod<"member.imports.create">;
  readonly importsRead: OperationMethod<"member.imports.read">;
}

export const MEMBER_METHOD_BY_OPERATION = Object.freeze({
  "member.members.read": "membersRead",
  "member.profile.read": "profileRead",
  "member.addresses.read": "addressesRead",
  "member.addresses.manage": "addressesManage",
  "member.favorites.read": "favoritesRead",
  "member.favorites.put": "favoritesPut",
  "member.imports.create": "importsCreate",
  "member.imports.read": "importsRead",
} as const satisfies Readonly<Record<(typeof MEMBER_OPERATION_IDS)[number], keyof MemberOperations>>);

export function createFetchMember(baseUrl: string): MemberOperations { return createMemberOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createMemberOperations(client: OperationExecutor): MemberOperations { return Object.freeze({
    membersRead: bindMembersRead(client),
    profileRead: bindProfileRead(client),
    addressesRead: bindAddressesRead(client),
    addressesManage: bindAddressesManage(client),
    favoritesRead: bindFavoritesRead(client),
    favoritesPut: bindFavoritesPut(client),
    importsCreate: bindImportsCreate(client),
    importsRead: bindImportsRead(client),
  }); }

export function createFetchMemberMembersRead(baseUrl: string): OperationMethod<"member.members.read"> { return bindMembersRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindMembersRead(client: OperationExecutor): OperationMethod<"member.members.read"> { return bindOperation(client, defineOperation({ ...{"id":"member.members.read","method":"GET","path":"/api/v1/members","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(MEMBER_QUERY_SCHEMAS.MemberMembersReadInput, [] as const, false), output: exactOperationOutputFrom(MEMBER_OUTPUT_SCHEMAS.MemberMembersReadOutput) })); }

export function createFetchMemberProfileRead(baseUrl: string): OperationMethod<"member.profile.read"> { return bindProfileRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindProfileRead(client: OperationExecutor): OperationMethod<"member.profile.read"> { return bindOperation(client, defineOperation({ ...{"id":"member.profile.read","method":"GET","path":"/api/v1/members/me","audience":"public","targets":["console","storefront","miniapp","store","supplier"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(MEMBER_QUERY_SCHEMAS.MemberProfileReadInput, [] as const, false), output: exactOperationOutputFrom(MEMBER_OUTPUT_SCHEMAS.MemberProfileReadOutput) })); }

export function createFetchMemberAddressesRead(baseUrl: string): OperationMethod<"member.addresses.read"> { return bindAddressesRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindAddressesRead(client: OperationExecutor): OperationMethod<"member.addresses.read"> { return bindOperation(client, defineOperation({ ...{"id":"member.addresses.read","method":"GET","path":"/api/v1/members/me/addresses","audience":"storefront","targets":["storefront","miniapp"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(MEMBER_QUERY_SCHEMAS.MemberAddressesReadInput, [] as const, false), output: exactOperationOutputFrom(MEMBER_OUTPUT_SCHEMAS.MemberAddressesReadOutput) })); }

export function createFetchMemberAddressesManage(baseUrl: string): OperationMethod<"member.addresses.manage"> { return bindAddressesManage(new ApiClient(baseUrl, new FetchTransport())); }

export function bindAddressesManage(client: OperationExecutor): OperationMethod<"member.addresses.manage"> { return bindOperation(client, defineOperation({ ...{"id":"member.addresses.manage","method":"PUT","path":"/api/v1/members/me/addresses/{addressid}","audience":"storefront","targets":["storefront","miniapp"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInputFrom(MEMBER_BODY_SCHEMAS.MemberAddressesManageInput, ["addressid"] as const, true), output: exactOperationOutputFrom(MEMBER_OUTPUT_SCHEMAS.MemberAddressesManageOutput) })); }

export function createFetchMemberFavoritesRead(baseUrl: string): OperationMethod<"member.favorites.read"> { return bindFavoritesRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindFavoritesRead(client: OperationExecutor): OperationMethod<"member.favorites.read"> { return bindOperation(client, defineOperation({ ...{"id":"member.favorites.read","method":"GET","path":"/api/v1/members/me/favorites","audience":"storefront","targets":["storefront","miniapp"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(MEMBER_QUERY_SCHEMAS.MemberFavoritesReadInput, [] as const, false), output: exactOperationOutputFrom(MEMBER_OUTPUT_SCHEMAS.MemberFavoritesReadOutput) })); }

export function createFetchMemberFavoritesPut(baseUrl: string): OperationMethod<"member.favorites.put"> { return bindFavoritesPut(new ApiClient(baseUrl, new FetchTransport())); }

export function bindFavoritesPut(client: OperationExecutor): OperationMethod<"member.favorites.put"> { return bindOperation(client, defineOperation({ ...{"id":"member.favorites.put","method":"PUT","path":"/api/v1/members/me/favorites/{listingid}","audience":"storefront","targets":["storefront","miniapp"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","RESOURCE_NOT_FOUND","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(MEMBER_BODY_SCHEMAS.MemberFavoritesPutInput, ["listingid"] as const, true), output: exactOperationOutputFrom(MEMBER_OUTPUT_SCHEMAS.MemberFavoritesPutOutput) })); }

export function createFetchMemberImportsCreate(baseUrl: string): OperationMethod<"member.imports.create"> { return bindImportsCreate(new ApiClient(baseUrl, new FetchTransport())); }

export function bindImportsCreate(client: OperationExecutor): OperationMethod<"member.imports.create"> { return bindOperation(client, defineOperation({ ...{"id":"member.imports.create","method":"POST","path":"/api/v1/members/imports","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(MEMBER_BODY_SCHEMAS.MemberImportsCreateInput, [] as const, true), output: exactOperationOutputFrom(MEMBER_OUTPUT_SCHEMAS.MemberImportsCreateOutput) })); }

export function createFetchMemberImportsRead(baseUrl: string): OperationMethod<"member.imports.read"> { return bindImportsRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindImportsRead(client: OperationExecutor): OperationMethod<"member.imports.read"> { return bindOperation(client, defineOperation({ ...{"id":"member.imports.read","method":"GET","path":"/api/v1/members/imports/{importid}","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(MEMBER_QUERY_SCHEMAS.MemberImportsReadInput, ["importid"] as const, false), output: exactOperationOutputFrom(MEMBER_OUTPUT_SCHEMAS.MemberImportsReadOutput) })); }
