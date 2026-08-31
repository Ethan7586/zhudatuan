// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

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

function bindMembersRead(client: OperationExecutor): OperationMethod<"member.members.read"> { return bindOperation(client, defineOperation({"id":"member.members.read","method":"GET","path":"/api/v1/members","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchMemberProfileRead(baseUrl: string): OperationMethod<"member.profile.read"> { return bindProfileRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindProfileRead(client: OperationExecutor): OperationMethod<"member.profile.read"> { return bindOperation(client, defineOperation({"id":"member.profile.read","method":"GET","path":"/api/v1/members/me","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchMemberAddressesRead(baseUrl: string): OperationMethod<"member.addresses.read"> { return bindAddressesRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindAddressesRead(client: OperationExecutor): OperationMethod<"member.addresses.read"> { return bindOperation(client, defineOperation({"id":"member.addresses.read","method":"GET","path":"/api/v1/members/me/addresses","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchMemberAddressesManage(baseUrl: string): OperationMethod<"member.addresses.manage"> { return bindAddressesManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindAddressesManage(client: OperationExecutor): OperationMethod<"member.addresses.manage"> { return bindOperation(client, defineOperation({"id":"member.addresses.manage","method":"PUT","path":"/api/v1/members/me/addresses/{addressid}","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchMemberFavoritesRead(baseUrl: string): OperationMethod<"member.favorites.read"> { return bindFavoritesRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindFavoritesRead(client: OperationExecutor): OperationMethod<"member.favorites.read"> { return bindOperation(client, defineOperation({"id":"member.favorites.read","method":"GET","path":"/api/v1/members/me/favorites","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchMemberFavoritesPut(baseUrl: string): OperationMethod<"member.favorites.put"> { return bindFavoritesPut(new ApiClient(baseUrl, new FetchTransport())); }

function bindFavoritesPut(client: OperationExecutor): OperationMethod<"member.favorites.put"> { return bindOperation(client, defineOperation({"id":"member.favorites.put","method":"PUT","path":"/api/v1/members/me/favorites/{listingid}","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchMemberImportsCreate(baseUrl: string): OperationMethod<"member.imports.create"> { return bindImportsCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindImportsCreate(client: OperationExecutor): OperationMethod<"member.imports.create"> { return bindOperation(client, defineOperation({"id":"member.imports.create","method":"POST","path":"/api/v1/members/imports","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchMemberImportsRead(baseUrl: string): OperationMethod<"member.imports.read"> { return bindImportsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindImportsRead(client: OperationExecutor): OperationMethod<"member.imports.read"> { return bindOperation(client, defineOperation({"id":"member.imports.read","method":"GET","path":"/api/v1/members/imports/{importid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }
