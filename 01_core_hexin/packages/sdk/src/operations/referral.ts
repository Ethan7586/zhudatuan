// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineContractOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const REFERRAL_OPERATION_IDS = /* @__PURE__ */ Object.freeze([
  "referral.settings.read",
  "referral.settings.manage",
  "referral.products.read",
  "referral.products.manage",
  "referral.members.read",
  "referral.members.apply",
  "referral.members.approve",
  "referral.members.disqualify",
  "referral.bindings.read",
  "referral.bindings.create",
  "referral.commissions.read",
  "referral.earnings.read",
  "referral.links.read",
  "referral.withdrawals.read",
  "referral.withdrawals.create",
] as const satisfies readonly OperationId[]);

export interface ReferralOperations {
  readonly settingsRead: OperationMethod<"referral.settings.read">;
  readonly settingsManage: OperationMethod<"referral.settings.manage">;
  readonly productsRead: OperationMethod<"referral.products.read">;
  readonly productsManage: OperationMethod<"referral.products.manage">;
  readonly membersRead: OperationMethod<"referral.members.read">;
  readonly membersApply: OperationMethod<"referral.members.apply">;
  readonly membersApprove: OperationMethod<"referral.members.approve">;
  readonly membersDisqualify: OperationMethod<"referral.members.disqualify">;
  readonly bindingsRead: OperationMethod<"referral.bindings.read">;
  readonly bindingsCreate: OperationMethod<"referral.bindings.create">;
  readonly commissionsRead: OperationMethod<"referral.commissions.read">;
  readonly earningsRead: OperationMethod<"referral.earnings.read">;
  readonly linksRead: OperationMethod<"referral.links.read">;
  readonly withdrawalsRead: OperationMethod<"referral.withdrawals.read">;
  readonly withdrawalsCreate: OperationMethod<"referral.withdrawals.create">;
}

export function createFetchReferral(baseUrl: string): ReferralOperations {
  return createReferralOperations(new ApiClient(baseUrl, new FetchTransport()));
}

export function createReferralOperations(client: OperationExecutor): ReferralOperations {
  return Object.freeze({
    settingsRead: bindSettingsRead(client),
    settingsManage: bindSettingsManage(client),
    productsRead: bindProductsRead(client),
    productsManage: bindProductsManage(client),
    membersRead: bindMembersRead(client),
    membersApply: bindMembersApply(client),
    membersApprove: bindMembersApprove(client),
    membersDisqualify: bindMembersDisqualify(client),
    bindingsRead: bindBindingsRead(client),
    bindingsCreate: bindBindingsCreate(client),
    commissionsRead: bindCommissionsRead(client),
    earningsRead: bindEarningsRead(client),
    linksRead: bindLinksRead(client),
    withdrawalsRead: bindWithdrawalsRead(client),
    withdrawalsCreate: bindWithdrawalsCreate(client),
  });
}

export function createFetchReferralSettingsRead(baseUrl: string): OperationMethod<"referral.settings.read"> {
  return bindSettingsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindSettingsRead(client: OperationExecutor): OperationMethod<"referral.settings.read"> {
  return bindOperation(client, defineContractOperation({"id":"referral.settings.read","method":"GET","path":"/api/v1/referral/settings","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchReferralSettingsManage(baseUrl: string): OperationMethod<"referral.settings.manage"> {
  return bindSettingsManage(new ApiClient(baseUrl, new FetchTransport()));
}

function bindSettingsManage(client: OperationExecutor): OperationMethod<"referral.settings.manage"> {
  return bindOperation(client, defineContractOperation({"id":"referral.settings.manage","method":"PUT","path":"/api/v1/referral/settings","audience":"operator","idempotent":true,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchReferralProductsRead(baseUrl: string): OperationMethod<"referral.products.read"> {
  return bindProductsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindProductsRead(client: OperationExecutor): OperationMethod<"referral.products.read"> {
  return bindOperation(client, defineContractOperation({"id":"referral.products.read","method":"GET","path":"/api/v1/referral/products","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchReferralProductsManage(baseUrl: string): OperationMethod<"referral.products.manage"> {
  return bindProductsManage(new ApiClient(baseUrl, new FetchTransport()));
}

function bindProductsManage(client: OperationExecutor): OperationMethod<"referral.products.manage"> {
  return bindOperation(client, defineContractOperation({"id":"referral.products.manage","method":"PUT","path":"/api/v1/referral/products","audience":"operator","idempotent":true,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchReferralMembersRead(baseUrl: string): OperationMethod<"referral.members.read"> {
  return bindMembersRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindMembersRead(client: OperationExecutor): OperationMethod<"referral.members.read"> {
  return bindOperation(client, defineContractOperation({"id":"referral.members.read","method":"GET","path":"/api/v1/referral/members","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchReferralMembersApply(baseUrl: string): OperationMethod<"referral.members.apply"> {
  return bindMembersApply(new ApiClient(baseUrl, new FetchTransport()));
}

function bindMembersApply(client: OperationExecutor): OperationMethod<"referral.members.apply"> {
  return bindOperation(client, defineContractOperation({"id":"referral.members.apply","method":"POST","path":"/api/v1/referral/members/apply","audience":"member","idempotent":false,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchReferralMembersApprove(baseUrl: string): OperationMethod<"referral.members.approve"> {
  return bindMembersApprove(new ApiClient(baseUrl, new FetchTransport()));
}

function bindMembersApprove(client: OperationExecutor): OperationMethod<"referral.members.approve"> {
  return bindOperation(client, defineContractOperation({"id":"referral.members.approve","method":"POST","path":"/api/v1/referral/members/approve","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchReferralMembersDisqualify(baseUrl: string): OperationMethod<"referral.members.disqualify"> {
  return bindMembersDisqualify(new ApiClient(baseUrl, new FetchTransport()));
}

function bindMembersDisqualify(client: OperationExecutor): OperationMethod<"referral.members.disqualify"> {
  return bindOperation(client, defineContractOperation({"id":"referral.members.disqualify","method":"POST","path":"/api/v1/referral/members/disqualify","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchReferralBindingsRead(baseUrl: string): OperationMethod<"referral.bindings.read"> {
  return bindBindingsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindBindingsRead(client: OperationExecutor): OperationMethod<"referral.bindings.read"> {
  return bindOperation(client, defineContractOperation({"id":"referral.bindings.read","method":"GET","path":"/api/v1/referral/bindings","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchReferralBindingsCreate(baseUrl: string): OperationMethod<"referral.bindings.create"> {
  return bindBindingsCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindBindingsCreate(client: OperationExecutor): OperationMethod<"referral.bindings.create"> {
  return bindOperation(client, defineContractOperation({"id":"referral.bindings.create","method":"POST","path":"/api/v1/referral/bindings","audience":"member","idempotent":false,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchReferralCommissionsRead(baseUrl: string): OperationMethod<"referral.commissions.read"> {
  return bindCommissionsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindCommissionsRead(client: OperationExecutor): OperationMethod<"referral.commissions.read"> {
  return bindOperation(client, defineContractOperation({"id":"referral.commissions.read","method":"GET","path":"/api/v1/referral/commissions","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchReferralEarningsRead(baseUrl: string): OperationMethod<"referral.earnings.read"> {
  return bindEarningsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindEarningsRead(client: OperationExecutor): OperationMethod<"referral.earnings.read"> {
  return bindOperation(client, defineContractOperation({"id":"referral.earnings.read","method":"GET","path":"/api/v1/referral/earnings","audience":"member","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchReferralLinksRead(baseUrl: string): OperationMethod<"referral.links.read"> {
  return bindLinksRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindLinksRead(client: OperationExecutor): OperationMethod<"referral.links.read"> {
  return bindOperation(client, defineContractOperation({"id":"referral.links.read","method":"GET","path":"/api/v1/referral/links","audience":"member","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchReferralWithdrawalsRead(baseUrl: string): OperationMethod<"referral.withdrawals.read"> {
  return bindWithdrawalsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindWithdrawalsRead(client: OperationExecutor): OperationMethod<"referral.withdrawals.read"> {
  return bindOperation(client, defineContractOperation({"id":"referral.withdrawals.read","method":"GET","path":"/api/v1/referral/withdrawals","audience":"member","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchReferralWithdrawalsCreate(baseUrl: string): OperationMethod<"referral.withdrawals.create"> {
  return bindWithdrawalsCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindWithdrawalsCreate(client: OperationExecutor): OperationMethod<"referral.withdrawals.create"> {
  return bindOperation(client, defineContractOperation({"id":"referral.withdrawals.create","method":"POST","path":"/api/v1/referral/withdrawals","audience":"member","idempotent":false,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}
