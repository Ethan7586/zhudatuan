// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const PAYMENT_OPERATION_IDS = Object.freeze([
  "payment.intents.read",
  "payment.refunds.request",
  "payment.recoveries.read",
  "payment.recoveries.resolve",
  "payment.webhooks.wechat",
] as const satisfies readonly OperationId[]);

export interface PaymentOperations {
  readonly intentsRead: OperationMethod<"payment.intents.read">;
  readonly refundsRequest: OperationMethod<"payment.refunds.request">;
  readonly recoveriesRead: OperationMethod<"payment.recoveries.read">;
  readonly recoveriesResolve: OperationMethod<"payment.recoveries.resolve">;
  readonly webhooksWechat: OperationMethod<"payment.webhooks.wechat">;
}

export function createFetchPayment(baseUrl: string): PaymentOperations { return createPaymentOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createPaymentOperations(client: OperationExecutor): PaymentOperations { return Object.freeze({
    intentsRead: bindIntentsRead(client),
    refundsRequest: bindRefundsRequest(client),
    recoveriesRead: bindRecoveriesRead(client),
    recoveriesResolve: bindRecoveriesResolve(client),
    webhooksWechat: bindWebhooksWechat(client),
  }); }

export function createFetchPaymentIntentsRead(baseUrl: string): OperationMethod<"payment.intents.read"> { return bindIntentsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindIntentsRead(client: OperationExecutor): OperationMethod<"payment.intents.read"> { return bindOperation(client, defineOperation({"id":"payment.intents.read","method":"GET","path":"/api/v1/payments/intents/{paymentid}","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchPaymentRefundsRequest(baseUrl: string): OperationMethod<"payment.refunds.request"> { return bindRefundsRequest(new ApiClient(baseUrl, new FetchTransport())); }

function bindRefundsRequest(client: OperationExecutor): OperationMethod<"payment.refunds.request"> { return bindOperation(client, defineOperation({"id":"payment.refunds.request","method":"POST","path":"/api/v1/payments/refunds","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchPaymentRecoveriesRead(baseUrl: string): OperationMethod<"payment.recoveries.read"> { return bindRecoveriesRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindRecoveriesRead(client: OperationExecutor): OperationMethod<"payment.recoveries.read"> { return bindOperation(client, defineOperation({"id":"payment.recoveries.read","method":"GET","path":"/api/v1/payments/recoveries","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchPaymentRecoveriesResolve(baseUrl: string): OperationMethod<"payment.recoveries.resolve"> { return bindRecoveriesResolve(new ApiClient(baseUrl, new FetchTransport())); }

function bindRecoveriesResolve(client: OperationExecutor): OperationMethod<"payment.recoveries.resolve"> { return bindOperation(client, defineOperation({"id":"payment.recoveries.resolve","method":"POST","path":"/api/v1/payments/recoveries/{caseid}/resolutions","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchPaymentWebhooksWechat(baseUrl: string): OperationMethod<"payment.webhooks.wechat"> { return bindWebhooksWechat(new ApiClient(baseUrl, new FetchTransport())); }

function bindWebhooksWechat(client: OperationExecutor): OperationMethod<"payment.webhooks.wechat"> { return bindOperation(client, defineOperation({"id":"payment.webhooks.wechat","method":"POST","path":"/api/v1/webhooks/wechat/payment","audience":"webhook","targets":[],"responseMode":"json","idempotent":true,"timeout":500})); }
