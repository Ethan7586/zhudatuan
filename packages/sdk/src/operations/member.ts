// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineStructuralOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const MEMBER_OPERATION_IDS = /* @__PURE__ */ Object.freeze([
  "member.members.read",
  "member.invitations.read",
  "member.profile.read",
  "member.addresses.read",
  "member.addresses.manage",
  "member.imports.create",
  "member.imports.read",
] as const satisfies readonly OperationId[]);

export interface MemberOperations {
  readonly membersRead: OperationMethod<"member.members.read">;
  readonly invitationsRead: OperationMethod<"member.invitations.read">;
  readonly profileRead: OperationMethod<"member.profile.read">;
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
    invitationsRead: bindInvitationsRead(client),
    profileRead: bindProfileRead(client),
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
  return bindOperation(client, defineStructuralOperation({"id":"member.members.read","method":"GET","path":"/api/v1/members","audience":"operator","idempotent":true,"pathKeys":[]}));
}

export function createFetchMemberInvitationsRead(baseUrl: string): OperationMethod<"member.invitations.read"> {
  return bindInvitationsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindInvitationsRead(client: OperationExecutor): OperationMethod<"member.invitations.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"member.invitations.read","method":"GET","path":"/api/v1/member/invitations","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime","pathKeys":[]}));
}

export function createFetchMemberProfileRead(baseUrl: string): OperationMethod<"member.profile.read"> {
  return bindProfileRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindProfileRead(client: OperationExecutor): OperationMethod<"member.profile.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"member.profile.read","method":"GET","path":"/api/v1/members/me","audience":"member","idempotent":true,"pathKeys":[]}));
}

export function createFetchMemberAddressesRead(baseUrl: string): OperationMethod<"member.addresses.read"> {
  return bindAddressesRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindAddressesRead(client: OperationExecutor): OperationMethod<"member.addresses.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"member.addresses.read","method":"GET","path":"/api/v1/members/me/addresses","audience":"member","idempotent":true,"pathKeys":[]}));
}

export function createFetchMemberAddressesManage(baseUrl: string): OperationMethod<"member.addresses.manage"> {
  return bindAddressesManage(new ApiClient(baseUrl, new FetchTransport()));
}

function bindAddressesManage(client: OperationExecutor): OperationMethod<"member.addresses.manage"> {
  return bindOperation(client, defineStructuralOperation({"id":"member.addresses.manage","method":"PUT","path":"/api/v1/members/me/addresses/{addressid}","audience":"member","idempotent":true,"pathKeys":["addressid"]}));
}

export function createFetchMemberImportsCreate(baseUrl: string): OperationMethod<"member.imports.create"> {
  return bindImportsCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindImportsCreate(client: OperationExecutor): OperationMethod<"member.imports.create"> {
  return bindOperation(client, defineStructuralOperation({"id":"member.imports.create","method":"POST","path":"/api/v1/members/imports","audience":"operator","idempotent":false,"pathKeys":[]}));
}

export function createFetchMemberImportsRead(baseUrl: string): OperationMethod<"member.imports.read"> {
  return bindImportsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindImportsRead(client: OperationExecutor): OperationMethod<"member.imports.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"member.imports.read","method":"GET","path":"/api/v1/members/imports/{importid}","audience":"operator","idempotent":true,"pathKeys":["importid"]}));
}
