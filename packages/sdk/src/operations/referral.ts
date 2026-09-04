// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInput, exactOperationOutput } from '@shop/contract/schema';
import { defineOperation } from '../CatalogOperationDescriptor';

export const REFERRAL_OPERATION_IDS = Object.freeze([
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

export const REFERRAL_METHOD_BY_OPERATION = Object.freeze({
  "referral.settings.read": "settingsRead",
  "referral.settings.manage": "settingsManage",
  "referral.products.read": "productsRead",
  "referral.products.manage": "productsManage",
  "referral.members.read": "membersRead",
  "referral.members.apply": "membersApply",
  "referral.members.approve": "membersApprove",
  "referral.members.disqualify": "membersDisqualify",
  "referral.bindings.read": "bindingsRead",
  "referral.bindings.create": "bindingsCreate",
  "referral.commissions.read": "commissionsRead",
  "referral.earnings.read": "earningsRead",
  "referral.links.read": "linksRead",
  "referral.withdrawals.read": "withdrawalsRead",
  "referral.withdrawals.create": "withdrawalsCreate",
} as const satisfies Readonly<Record<(typeof REFERRAL_OPERATION_IDS)[number], keyof ReferralOperations>>);

export function createFetchReferral(baseUrl: string): ReferralOperations { return createReferralOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createReferralOperations(client: OperationExecutor): ReferralOperations { return Object.freeze({
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
  }); }

export function createFetchReferralSettingsRead(baseUrl: string): OperationMethod<"referral.settings.read"> { return bindSettingsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindSettingsRead(client: OperationExecutor): OperationMethod<"referral.settings.read"> { return bindOperation(client, defineOperation({ ...{"id":"referral.settings.read","method":"GET","path":"/api/v1/referral/settings","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ReferralSettingsReadInput", [] as const, false), output: exactOperationOutput("ReferralSettingsReadOutput") })); }

export function createFetchReferralSettingsManage(baseUrl: string): OperationMethod<"referral.settings.manage"> { return bindSettingsManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindSettingsManage(client: OperationExecutor): OperationMethod<"referral.settings.manage"> { return bindOperation(client, defineOperation({ ...{"id":"referral.settings.manage","method":"PUT","path":"/api/v1/referral/settings/{settingid}","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_DENIED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REFERRAL_NOT_ELIGIBLE","REFERRAL_PRODUCT_DISABLED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("ReferralSettingsManageInput", ["settingid"] as const, true), output: exactOperationOutput("ReferralSettingsManageOutput") })); }

export function createFetchReferralProductsRead(baseUrl: string): OperationMethod<"referral.products.read"> { return bindProductsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindProductsRead(client: OperationExecutor): OperationMethod<"referral.products.read"> { return bindOperation(client, defineOperation({ ...{"id":"referral.products.read","method":"GET","path":"/api/v1/referral/products","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ReferralProductsReadInput", [] as const, false), output: exactOperationOutput("ReferralProductsReadOutput") })); }

export function createFetchReferralProductsManage(baseUrl: string): OperationMethod<"referral.products.manage"> { return bindProductsManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindProductsManage(client: OperationExecutor): OperationMethod<"referral.products.manage"> { return bindOperation(client, defineOperation({ ...{"id":"referral.products.manage","method":"PUT","path":"/api/v1/referral/products/{productid}","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_DENIED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REFERRAL_NOT_ELIGIBLE","REFERRAL_PRODUCT_DISABLED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("ReferralProductsManageInput", ["productid"] as const, true), output: exactOperationOutput("ReferralProductsManageOutput") })); }

export function createFetchReferralMembersRead(baseUrl: string): OperationMethod<"referral.members.read"> { return bindMembersRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindMembersRead(client: OperationExecutor): OperationMethod<"referral.members.read"> { return bindOperation(client, defineOperation({ ...{"id":"referral.members.read","method":"GET","path":"/api/v1/referral/members","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ReferralMembersReadInput", [] as const, false), output: exactOperationOutput("ReferralMembersReadOutput") })); }

export function createFetchReferralMembersApply(baseUrl: string): OperationMethod<"referral.members.apply"> { return bindMembersApply(new ApiClient(baseUrl, new FetchTransport())); }

function bindMembersApply(client: OperationExecutor): OperationMethod<"referral.members.apply"> { return bindOperation(client, defineOperation({ ...{"id":"referral.members.apply","method":"POST","path":"/api/v1/referral/members/applications","audience":"public","targets":["console","storefront","miniapp","store","supplier"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_DENIED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REFERRAL_ALREADY_BOUND","REFERRAL_INVALID_TOKEN","REFERRAL_NOT_ELIGIBLE","REFERRAL_PRODUCT_DISABLED","REFERRAL_RATE_INVALID","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("ReferralMembersApplyInput", [] as const, true), output: exactOperationOutput("ReferralMembersApplyOutput") })); }

export function createFetchReferralMembersApprove(baseUrl: string): OperationMethod<"referral.members.approve"> { return bindMembersApprove(new ApiClient(baseUrl, new FetchTransport())); }

function bindMembersApprove(client: OperationExecutor): OperationMethod<"referral.members.approve"> { return bindOperation(client, defineOperation({ ...{"id":"referral.members.approve","method":"POST","path":"/api/v1/referral/members/{memberid}/approvals","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_DENIED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REFERRAL_NOT_ELIGIBLE","REFERRAL_PRODUCT_DISABLED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("ReferralMembersApproveInput", ["memberid"] as const, true), output: exactOperationOutput("ReferralMembersApproveOutput") })); }

export function createFetchReferralMembersDisqualify(baseUrl: string): OperationMethod<"referral.members.disqualify"> { return bindMembersDisqualify(new ApiClient(baseUrl, new FetchTransport())); }

function bindMembersDisqualify(client: OperationExecutor): OperationMethod<"referral.members.disqualify"> { return bindOperation(client, defineOperation({ ...{"id":"referral.members.disqualify","method":"POST","path":"/api/v1/referral/members/{memberid}/disqualifications","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_DENIED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REFERRAL_NOT_ELIGIBLE","REFERRAL_PRODUCT_DISABLED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("ReferralMembersDisqualifyInput", ["memberid"] as const, true), output: exactOperationOutput("ReferralMembersDisqualifyOutput") })); }

export function createFetchReferralBindingsRead(baseUrl: string): OperationMethod<"referral.bindings.read"> { return bindBindingsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindBindingsRead(client: OperationExecutor): OperationMethod<"referral.bindings.read"> { return bindOperation(client, defineOperation({ ...{"id":"referral.bindings.read","method":"GET","path":"/api/v1/referral/bindings","audience":"public","targets":["console","storefront","miniapp","store","supplier"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ReferralBindingsReadInput", [] as const, false), output: exactOperationOutput("ReferralBindingsReadOutput") })); }

export function createFetchReferralBindingsCreate(baseUrl: string): OperationMethod<"referral.bindings.create"> { return bindBindingsCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindBindingsCreate(client: OperationExecutor): OperationMethod<"referral.bindings.create"> { return bindOperation(client, defineOperation({ ...{"id":"referral.bindings.create","method":"POST","path":"/api/v1/referral/bindings","audience":"public","targets":["console","storefront","miniapp","store","supplier"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_DENIED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REFERRAL_ALREADY_BOUND","REFERRAL_INVALID_TOKEN","REFERRAL_NOT_ELIGIBLE","REFERRAL_PRODUCT_DISABLED","REFERRAL_RATE_INVALID","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("ReferralBindingsCreateInput", [] as const, true), output: exactOperationOutput("ReferralBindingsCreateOutput") })); }

export function createFetchReferralCommissionsRead(baseUrl: string): OperationMethod<"referral.commissions.read"> { return bindCommissionsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindCommissionsRead(client: OperationExecutor): OperationMethod<"referral.commissions.read"> { return bindOperation(client, defineOperation({ ...{"id":"referral.commissions.read","method":"GET","path":"/api/v1/referral/commissions","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ReferralCommissionsReadInput", [] as const, false), output: exactOperationOutput("ReferralCommissionsReadOutput") })); }

export function createFetchReferralEarningsRead(baseUrl: string): OperationMethod<"referral.earnings.read"> { return bindEarningsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindEarningsRead(client: OperationExecutor): OperationMethod<"referral.earnings.read"> { return bindOperation(client, defineOperation({ ...{"id":"referral.earnings.read","method":"GET","path":"/api/v1/referral/earnings","audience":"public","targets":["console","storefront","miniapp","store","supplier"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ReferralEarningsReadInput", [] as const, false), output: exactOperationOutput("ReferralEarningsReadOutput") })); }

export function createFetchReferralLinksRead(baseUrl: string): OperationMethod<"referral.links.read"> { return bindLinksRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindLinksRead(client: OperationExecutor): OperationMethod<"referral.links.read"> { return bindOperation(client, defineOperation({ ...{"id":"referral.links.read","method":"GET","path":"/api/v1/referral/links","audience":"public","targets":["console","storefront","miniapp","store","supplier"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ReferralLinksReadInput", [] as const, false), output: exactOperationOutput("ReferralLinksReadOutput") })); }

export function createFetchReferralWithdrawalsRead(baseUrl: string): OperationMethod<"referral.withdrawals.read"> { return bindWithdrawalsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindWithdrawalsRead(client: OperationExecutor): OperationMethod<"referral.withdrawals.read"> { return bindOperation(client, defineOperation({ ...{"id":"referral.withdrawals.read","method":"GET","path":"/api/v1/referral/withdrawals","audience":"public","targets":["console","storefront","miniapp","store","supplier"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ReferralWithdrawalsReadInput", [] as const, false), output: exactOperationOutput("ReferralWithdrawalsReadOutput") })); }

export function createFetchReferralWithdrawalsCreate(baseUrl: string): OperationMethod<"referral.withdrawals.create"> { return bindWithdrawalsCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindWithdrawalsCreate(client: OperationExecutor): OperationMethod<"referral.withdrawals.create"> { return bindOperation(client, defineOperation({ ...{"id":"referral.withdrawals.create","method":"POST","path":"/api/v1/referral/withdrawals","audience":"public","targets":["console","storefront","miniapp","store","supplier"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_DENIED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REFERRAL_WITHDRAWAL_CONFLICT","REFERRAL_WITHDRAWAL_TOO_SMALL","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("ReferralWithdrawalsCreateInput", [] as const, true), output: exactOperationOutput("ReferralWithdrawalsCreateOutput") })); }
