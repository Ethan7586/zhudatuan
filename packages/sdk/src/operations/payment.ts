// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInput, exactOperationOutput } from '@shop/contract/schema';
import { defineOperation } from '../CatalogOperationDescriptor';

export const PAYMENT_OPERATION_IDS = Object.freeze([
  "payment.intents.create",
  "payment.intents.read",
  "payment.refunds.request",
  "payment.recoveries.read",
  "payment.recoveries.resolve",
  "payment.webhooks.wechat",
] as const satisfies readonly OperationId[]);

export interface PaymentOperations {
  readonly intentsCreate: OperationMethod<"payment.intents.create">;
  readonly intentsRead: OperationMethod<"payment.intents.read">;
  readonly refundsRequest: OperationMethod<"payment.refunds.request">;
  readonly recoveriesRead: OperationMethod<"payment.recoveries.read">;
  readonly recoveriesResolve: OperationMethod<"payment.recoveries.resolve">;
  readonly webhooksWechat: OperationMethod<"payment.webhooks.wechat">;
}

export const PAYMENT_METHOD_BY_OPERATION = Object.freeze({
  "payment.intents.create": "intentsCreate",
  "payment.intents.read": "intentsRead",
  "payment.refunds.request": "refundsRequest",
  "payment.recoveries.read": "recoveriesRead",
  "payment.recoveries.resolve": "recoveriesResolve",
  "payment.webhooks.wechat": "webhooksWechat",
} as const satisfies Readonly<Record<(typeof PAYMENT_OPERATION_IDS)[number], keyof PaymentOperations>>);

export function createFetchPayment(baseUrl: string): PaymentOperations { return createPaymentOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createPaymentOperations(client: OperationExecutor): PaymentOperations { return Object.freeze({
    intentsCreate: bindIntentsCreate(client),
    intentsRead: bindIntentsRead(client),
    refundsRequest: bindRefundsRequest(client),
    recoveriesRead: bindRecoveriesRead(client),
    recoveriesResolve: bindRecoveriesResolve(client),
    webhooksWechat: bindWebhooksWechat(client),
  }); }

export function createFetchPaymentIntentsCreate(baseUrl: string): OperationMethod<"payment.intents.create"> { return bindIntentsCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindIntentsCreate(client: OperationExecutor): OperationMethod<"payment.intents.create"> { return bindOperation(client, defineOperation({ ...{"id":"payment.intents.create","method":"POST","path":"/api/v1/payments/intents","audience":"storefront","targets":["storefront","miniapp"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":3000,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PAYMENT_ALLOCATION_UNBALANCED","PAYMENT_INTENT_CONFLICT","PAYMENT_INTENT_NOT_PAYABLE","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","RESOURCE_NOT_FOUND","RISK_DENIED","RISK_REVIEW_REQUIRED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("PaymentIntentsCreateInput", [] as const, true), output: exactOperationOutput("PaymentIntentsCreateOutput") })); }

export function createFetchPaymentIntentsRead(baseUrl: string): OperationMethod<"payment.intents.read"> { return bindIntentsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindIntentsRead(client: OperationExecutor): OperationMethod<"payment.intents.read"> { return bindOperation(client, defineOperation({ ...{"id":"payment.intents.read","method":"GET","path":"/api/v1/payments/intents/{paymentid}","audience":"storefront","targets":["storefront","miniapp"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","RESOURCE_NOT_FOUND","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("PaymentIntentsReadInput", ["paymentid"] as const, false), output: exactOperationOutput("PaymentIntentsReadOutput") })); }

export function createFetchPaymentRefundsRequest(baseUrl: string): OperationMethod<"payment.refunds.request"> { return bindRefundsRequest(new ApiClient(baseUrl, new FetchTransport())); }

function bindRefundsRequest(client: OperationExecutor): OperationMethod<"payment.refunds.request"> { return bindOperation(client, defineOperation({ ...{"id":"payment.refunds.request","method":"POST","path":"/api/v1/payments/refunds","audience":"console","targets":["console","store"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_REQUIRED","PAYMENT_REFUND_EXCEEDS_AVAILABLE","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("PaymentRefundsRequestInput", [] as const, true), output: exactOperationOutput("PaymentRefundsRequestOutput") })); }

export function createFetchPaymentRecoveriesRead(baseUrl: string): OperationMethod<"payment.recoveries.read"> { return bindRecoveriesRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindRecoveriesRead(client: OperationExecutor): OperationMethod<"payment.recoveries.read"> { return bindOperation(client, defineOperation({ ...{"id":"payment.recoveries.read","method":"GET","path":"/api/v1/payments/recoveries","audience":"console","targets":["console","store"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PAYMENT_REFUND_EXCEEDS_AVAILABLE","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("PaymentRecoveriesReadInput", [] as const, false), output: exactOperationOutput("PaymentRecoveriesReadOutput") })); }

export function createFetchPaymentRecoveriesResolve(baseUrl: string): OperationMethod<"payment.recoveries.resolve"> { return bindRecoveriesResolve(new ApiClient(baseUrl, new FetchTransport())); }

function bindRecoveriesResolve(client: OperationExecutor): OperationMethod<"payment.recoveries.resolve"> { return bindOperation(client, defineOperation({ ...{"id":"payment.recoveries.resolve","method":"POST","path":"/api/v1/payments/recoveries/{caseid}/resolutions","audience":"console","targets":["console","store"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_REQUIRED","PAYMENT_REFUND_EXCEEDS_AVAILABLE","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("PaymentRecoveriesResolveInput", ["caseid"] as const, true), output: exactOperationOutput("PaymentRecoveriesResolveOutput") })); }

export function createFetchPaymentWebhooksWechat(baseUrl: string): OperationMethod<"payment.webhooks.wechat"> { return bindWebhooksWechat(new ApiClient(baseUrl, new FetchTransport())); }

function bindWebhooksWechat(client: OperationExecutor): OperationMethod<"payment.webhooks.wechat"> { return bindOperation(client, defineOperation({ ...{"id":"payment.webhooks.wechat","method":"POST","path":"/api/v1/webhooks/wechat/payment","audience":"webhook","targets":[],"responseMode":"json","idempotencyPolicy":"provider","idempotent":true,"timeout":500,"errorUnion":["AUTHORIZATION_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","INTERNAL_ERROR","PAYMENT_REFUND_EXCEEDS_AVAILABLE","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("PaymentWebhooksWechatInput", [] as const, true), output: exactOperationOutput("PaymentWebhooksWechatOutput") })); }
