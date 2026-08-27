// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineStructuralOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const PAYMENT_OPERATION_IDS = /* @__PURE__ */ Object.freeze([
  "payment.intents.create",
  "payment.refunds.request",
  "payment.recoveries.read",
  "payment.recoveries.resolve",
  "payment.webhooks.wechat",
] as const satisfies readonly OperationId[]);

export interface PaymentOperations {
  readonly intentsCreate: OperationMethod<"payment.intents.create">;
  readonly refundsRequest: OperationMethod<"payment.refunds.request">;
  readonly recoveriesRead: OperationMethod<"payment.recoveries.read">;
  readonly recoveriesResolve: OperationMethod<"payment.recoveries.resolve">;
  readonly webhooksWechat: OperationMethod<"payment.webhooks.wechat">;
}

export function createFetchPayment(baseUrl: string): PaymentOperations {
  return createPaymentOperations(new ApiClient(baseUrl, new FetchTransport()));
}

export function createPaymentOperations(client: OperationExecutor): PaymentOperations {
  return Object.freeze({
    intentsCreate: bindIntentsCreate(client),
    refundsRequest: bindRefundsRequest(client),
    recoveriesRead: bindRecoveriesRead(client),
    recoveriesResolve: bindRecoveriesResolve(client),
    webhooksWechat: bindWebhooksWechat(client),
  });
}

export function createFetchPaymentIntentsCreate(baseUrl: string): OperationMethod<"payment.intents.create"> {
  return bindIntentsCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindIntentsCreate(client: OperationExecutor): OperationMethod<"payment.intents.create"> {
  return bindOperation(client, defineStructuralOperation({"id":"payment.intents.create","method":"POST","path":"/api/v1/payments/intents","audience":"member","idempotent":false,"pathKeys":[]}));
}

export function createFetchPaymentRefundsRequest(baseUrl: string): OperationMethod<"payment.refunds.request"> {
  return bindRefundsRequest(new ApiClient(baseUrl, new FetchTransport()));
}

function bindRefundsRequest(client: OperationExecutor): OperationMethod<"payment.refunds.request"> {
  return bindOperation(client, defineStructuralOperation({"id":"payment.refunds.request","method":"POST","path":"/api/v1/payments/refunds","audience":"operator","idempotent":true,"pathKeys":[]}));
}

export function createFetchPaymentRecoveriesRead(baseUrl: string): OperationMethod<"payment.recoveries.read"> {
  return bindRecoveriesRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindRecoveriesRead(client: OperationExecutor): OperationMethod<"payment.recoveries.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"payment.recoveries.read","method":"GET","path":"/api/v1/payments/recoveries","audience":"operator","idempotent":true,"pathKeys":[]}));
}

export function createFetchPaymentRecoveriesResolve(baseUrl: string): OperationMethod<"payment.recoveries.resolve"> {
  return bindRecoveriesResolve(new ApiClient(baseUrl, new FetchTransport()));
}

function bindRecoveriesResolve(client: OperationExecutor): OperationMethod<"payment.recoveries.resolve"> {
  return bindOperation(client, defineStructuralOperation({"id":"payment.recoveries.resolve","method":"POST","path":"/api/v1/payments/recoveries/{caseid}/resolutions","audience":"operator","idempotent":true,"pathKeys":["caseid"]}));
}

export function createFetchPaymentWebhooksWechat(baseUrl: string): OperationMethod<"payment.webhooks.wechat"> {
  return bindWebhooksWechat(new ApiClient(baseUrl, new FetchTransport()));
}

function bindWebhooksWechat(client: OperationExecutor): OperationMethod<"payment.webhooks.wechat"> {
  return bindOperation(client, defineStructuralOperation({"id":"payment.webhooks.wechat","method":"POST","path":"/api/v1/webhooks/wechat/payment","audience":"provider","idempotent":true,"pathKeys":[]}));
}
