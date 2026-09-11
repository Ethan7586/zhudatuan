// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineContractOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const MEMBER_OPERATION_IDS = /* @__PURE__ */ Object.freeze([
  "member.members.read",
  "member.storefront.members.read",
  "member.storefront.detail.read",
  "member.storefront.invitees.read",
  "member.storefront.orders.read",
  "member.storefront.config.read",
  "member.storefront.config.manage",
  "member.storefront.custom.read",
  "member.storefront.custom.manage",
  "member.invitations.read",
  "member.profile.read",
  "member.malls.open",
  "member.sovereignty.upgrade",
  "member.addresses.read",
  "member.addresses.manage",
  "member.imports.create",
  "member.imports.read",
] as const satisfies readonly OperationId[]);

export interface MemberOperations {
  readonly membersRead: OperationMethod<"member.members.read">;
  readonly storefrontMembersRead: OperationMethod<"member.storefront.members.read">;
  readonly storefrontDetailRead: OperationMethod<"member.storefront.detail.read">;
  readonly storefrontInviteesRead: OperationMethod<"member.storefront.invitees.read">;
  readonly storefrontOrdersRead: OperationMethod<"member.storefront.orders.read">;
  readonly storefrontConfigRead: OperationMethod<"member.storefront.config.read">;
  readonly storefrontConfigManage: OperationMethod<"member.storefront.config.manage">;
  readonly storefrontCustomRead: OperationMethod<"member.storefront.custom.read">;
  readonly storefrontCustomManage: OperationMethod<"member.storefront.custom.manage">;
  readonly invitationsRead: OperationMethod<"member.invitations.read">;
  readonly profileRead: OperationMethod<"member.profile.read">;
  readonly mallsOpen: OperationMethod<"member.malls.open">;
  readonly sovereigntyUpgrade: OperationMethod<"member.sovereignty.upgrade">;
  readonly addressesRead: OperationMethod<"member.addresses.read">;
  readonly addressesManage: OperationMethod<"member.addresses.manage">;
  readonly importsCreate: OperationMethod<"member.imports.create">;
  readonly importsRead: OperationMethod<"member.imports.read">;
}

export function createFetchMember(baseUrl: string): MemberOperations {
  return createMemberOperations(new ApiClient(baseUrl, new FetchTransport()));
}

export function createMemberOperations(client: OperationExecutor): MemberOperations {
  return Object.freeze({
    membersRead: bindMembersRead(client),
    storefrontMembersRead: bindStorefrontMembersRead(client),
    storefrontDetailRead: bindStorefrontDetailRead(client),
    storefrontInviteesRead: bindStorefrontInviteesRead(client),
    storefrontOrdersRead: bindStorefrontOrdersRead(client),
    storefrontConfigRead: bindStorefrontConfigRead(client),
    storefrontConfigManage: bindStorefrontConfigManage(client),
    storefrontCustomRead: bindStorefrontCustomRead(client),
    storefrontCustomManage: bindStorefrontCustomManage(client),
    invitationsRead: bindInvitationsRead(client),
    profileRead: bindProfileRead(client),
    mallsOpen: bindMallsOpen(client),
    sovereigntyUpgrade: bindSovereigntyUpgrade(client),
    addressesRead: bindAddressesRead(client),
    addressesManage: bindAddressesManage(client),
    importsCreate: bindImportsCreate(client),
    importsRead: bindImportsRead(client),
  });
}

export function createFetchMemberMembersRead(baseUrl: string): OperationMethod<"member.members.read"> {
  return bindMembersRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindMembersRead(client: OperationExecutor): OperationMethod<"member.members.read"> {
  return bindOperation(client, defineContractOperation({"id":"member.members.read","method":"GET","path":"/api/v1/members","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchMemberStorefrontMembersRead(baseUrl: string): OperationMethod<"member.storefront.members.read"> {
  return bindStorefrontMembersRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindStorefrontMembersRead(client: OperationExecutor): OperationMethod<"member.storefront.members.read"> {
  return bindOperation(client, defineContractOperation({"id":"member.storefront.members.read","method":"GET","path":"/api/v1/member/storefront-members","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchMemberStorefrontDetailRead(baseUrl: string): OperationMethod<"member.storefront.detail.read"> {
  return bindStorefrontDetailRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindStorefrontDetailRead(client: OperationExecutor): OperationMethod<"member.storefront.detail.read"> {
  return bindOperation(client, defineContractOperation({"id":"member.storefront.detail.read","method":"GET","path":"/api/v1/member/storefront-members/{membershipid}","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchMemberStorefrontInviteesRead(baseUrl: string): OperationMethod<"member.storefront.invitees.read"> {
  return bindStorefrontInviteesRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindStorefrontInviteesRead(client: OperationExecutor): OperationMethod<"member.storefront.invitees.read"> {
  return bindOperation(client, defineContractOperation({"id":"member.storefront.invitees.read","method":"GET","path":"/api/v1/member/storefront-members/{membershipid}/invitees","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchMemberStorefrontOrdersRead(baseUrl: string): OperationMethod<"member.storefront.orders.read"> {
  return bindStorefrontOrdersRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindStorefrontOrdersRead(client: OperationExecutor): OperationMethod<"member.storefront.orders.read"> {
  return bindOperation(client, defineContractOperation({"id":"member.storefront.orders.read","method":"GET","path":"/api/v1/member/storefront-members/{membershipid}/orders","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchMemberStorefrontConfigRead(baseUrl: string): OperationMethod<"member.storefront.config.read"> {
  return bindStorefrontConfigRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindStorefrontConfigRead(client: OperationExecutor): OperationMethod<"member.storefront.config.read"> {
  return bindOperation(client, defineContractOperation({"id":"member.storefront.config.read","method":"GET","path":"/api/v1/member/storefront-profile-config","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchMemberStorefrontConfigManage(baseUrl: string): OperationMethod<"member.storefront.config.manage"> {
  return bindStorefrontConfigManage(new ApiClient(baseUrl, new FetchTransport()));
}

function bindStorefrontConfigManage(client: OperationExecutor): OperationMethod<"member.storefront.config.manage"> {
  return bindOperation(client, defineContractOperation({"id":"member.storefront.config.manage","method":"PUT","path":"/api/v1/member/storefront-profile-config","audience":"operator","idempotent":true,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchMemberStorefrontCustomRead(baseUrl: string): OperationMethod<"member.storefront.custom.read"> {
  return bindStorefrontCustomRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindStorefrontCustomRead(client: OperationExecutor): OperationMethod<"member.storefront.custom.read"> {
  return bindOperation(client, defineContractOperation({"id":"member.storefront.custom.read","method":"GET","path":"/api/v1/member/storefront-members/{membershipid}/custom-profile","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchMemberStorefrontCustomManage(baseUrl: string): OperationMethod<"member.storefront.custom.manage"> {
  return bindStorefrontCustomManage(new ApiClient(baseUrl, new FetchTransport()));
}

function bindStorefrontCustomManage(client: OperationExecutor): OperationMethod<"member.storefront.custom.manage"> {
  return bindOperation(client, defineContractOperation({"id":"member.storefront.custom.manage","method":"PUT","path":"/api/v1/member/storefront-members/{membershipid}/custom-profile","audience":"operator","idempotent":true,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchMemberInvitationsRead(baseUrl: string): OperationMethod<"member.invitations.read"> {
  return bindInvitationsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindInvitationsRead(client: OperationExecutor): OperationMethod<"member.invitations.read"> {
  return bindOperation(client, defineContractOperation({"id":"member.invitations.read","method":"GET","path":"/api/v1/member/invitations","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchMemberProfileRead(baseUrl: string): OperationMethod<"member.profile.read"> {
  return bindProfileRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindProfileRead(client: OperationExecutor): OperationMethod<"member.profile.read"> {
  return bindOperation(client, defineContractOperation({"id":"member.profile.read","method":"GET","path":"/api/v1/members/me","audience":"member","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchMemberMallsOpen(baseUrl: string): OperationMethod<"member.malls.open"> {
  return bindMallsOpen(new ApiClient(baseUrl, new FetchTransport()));
}

function bindMallsOpen(client: OperationExecutor): OperationMethod<"member.malls.open"> {
  return bindOperation(client, defineContractOperation({"id":"member.malls.open","method":"POST","path":"/api/v1/members/me/mall","audience":"member","idempotent":false,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchMemberSovereigntyUpgrade(baseUrl: string): OperationMethod<"member.sovereignty.upgrade"> {
  return bindSovereigntyUpgrade(new ApiClient(baseUrl, new FetchTransport()));
}

function bindSovereigntyUpgrade(client: OperationExecutor): OperationMethod<"member.sovereignty.upgrade"> {
  return bindOperation(client, defineContractOperation({"id":"member.sovereignty.upgrade","method":"POST","path":"/api/v1/members/me/sovereignty","audience":"member","idempotent":false,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchMemberAddressesRead(baseUrl: string): OperationMethod<"member.addresses.read"> {
  return bindAddressesRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindAddressesRead(client: OperationExecutor): OperationMethod<"member.addresses.read"> {
  return bindOperation(client, defineContractOperation({"id":"member.addresses.read","method":"GET","path":"/api/v1/members/me/addresses","audience":"member","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchMemberAddressesManage(baseUrl: string): OperationMethod<"member.addresses.manage"> {
  return bindAddressesManage(new ApiClient(baseUrl, new FetchTransport()));
}

function bindAddressesManage(client: OperationExecutor): OperationMethod<"member.addresses.manage"> {
  return bindOperation(client, defineContractOperation({"id":"member.addresses.manage","method":"PUT","path":"/api/v1/members/me/addresses/{addressid}","audience":"member","idempotent":true,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchMemberImportsCreate(baseUrl: string): OperationMethod<"member.imports.create"> {
  return bindImportsCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindImportsCreate(client: OperationExecutor): OperationMethod<"member.imports.create"> {
  return bindOperation(client, defineContractOperation({"id":"member.imports.create","method":"POST","path":"/api/v1/members/imports","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchMemberImportsRead(baseUrl: string): OperationMethod<"member.imports.read"> {
  return bindImportsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindImportsRead(client: OperationExecutor): OperationMethod<"member.imports.read"> {
  return bindOperation(client, defineContractOperation({"id":"member.imports.read","method":"GET","path":"/api/v1/members/imports/{importid}","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}
