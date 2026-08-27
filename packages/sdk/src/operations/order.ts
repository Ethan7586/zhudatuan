// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineStructuralOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const ORDER_OPERATION_IDS = /* @__PURE__ */ Object.freeze([
  "order.orders.create",
  "order.orders.read",
  "order.reminders.create",
  "order.orders.export",
  "order.aftersales.read",
  "order.aftersales.apply",
  "order.aftersales.approve",
  "order.aftersales.reject",
] as const satisfies readonly OperationId[]);

export interface OrderOperations {
  readonly ordersCreate: OperationMethod<"order.orders.create">;
  readonly ordersRead: OperationMethod<"order.orders.read">;
  readonly remindersCreate: OperationMethod<"order.reminders.create">;
  readonly ordersExport: OperationMethod<"order.orders.export">;
  readonly aftersalesRead: OperationMethod<"order.aftersales.read">;
  readonly aftersalesApply: OperationMethod<"order.aftersales.apply">;
  readonly aftersalesApprove: OperationMethod<"order.aftersales.approve">;
  readonly aftersalesReject: OperationMethod<"order.aftersales.reject">;
}

export function createFetchOrder(baseUrl: string): OrderOperations {
  return createOrderOperations(new ApiClient(baseUrl, new FetchTransport()));
}

export function createOrderOperations(client: OperationExecutor): OrderOperations {
  return Object.freeze({
    ordersCreate: bindOrdersCreate(client),
    ordersRead: bindOrdersRead(client),
    remindersCreate: bindRemindersCreate(client),
    ordersExport: bindOrdersExport(client),
    aftersalesRead: bindAftersalesRead(client),
    aftersalesApply: bindAftersalesApply(client),
    aftersalesApprove: bindAftersalesApprove(client),
    aftersalesReject: bindAftersalesReject(client),
  });
}

export function createFetchOrderOrdersCreate(baseUrl: string): OperationMethod<"order.orders.create"> {
  return bindOrdersCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindOrdersCreate(client: OperationExecutor): OperationMethod<"order.orders.create"> {
  return bindOperation(client, defineStructuralOperation({"id":"order.orders.create","method":"POST","path":"/api/v1/orders","audience":"member","idempotent":false,"pathKeys":[]}));
}

export function createFetchOrderOrdersRead(baseUrl: string): OperationMethod<"order.orders.read"> {
  return bindOrdersRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindOrdersRead(client: OperationExecutor): OperationMethod<"order.orders.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"order.orders.read","method":"GET","path":"/api/v1/orders","audience":"member","idempotent":true,"pathKeys":[]}));
}

export function createFetchOrderRemindersCreate(baseUrl: string): OperationMethod<"order.reminders.create"> {
  return bindRemindersCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindRemindersCreate(client: OperationExecutor): OperationMethod<"order.reminders.create"> {
  return bindOperation(client, defineStructuralOperation({"id":"order.reminders.create","method":"POST","path":"/api/v1/orders/{orderid}/reminders","audience":"member","idempotent":false,"pathKeys":["orderid"]}));
}

export function createFetchOrderOrdersExport(baseUrl: string): OperationMethod<"order.orders.export"> {
  return bindOrdersExport(new ApiClient(baseUrl, new FetchTransport()));
}

function bindOrdersExport(client: OperationExecutor): OperationMethod<"order.orders.export"> {
  return bindOperation(client, defineStructuralOperation({"id":"order.orders.export","method":"POST","path":"/api/v1/orders/exports","audience":"operator","idempotent":false,"pathKeys":[]}));
}

export function createFetchOrderAftersalesRead(baseUrl: string): OperationMethod<"order.aftersales.read"> {
  return bindAftersalesRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindAftersalesRead(client: OperationExecutor): OperationMethod<"order.aftersales.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"order.aftersales.read","method":"GET","path":"/api/v1/orders/aftersales","audience":"member","idempotent":true,"pathKeys":[]}));
}

export function createFetchOrderAftersalesApply(baseUrl: string): OperationMethod<"order.aftersales.apply"> {
  return bindAftersalesApply(new ApiClient(baseUrl, new FetchTransport()));
}

function bindAftersalesApply(client: OperationExecutor): OperationMethod<"order.aftersales.apply"> {
  return bindOperation(client, defineStructuralOperation({"id":"order.aftersales.apply","method":"POST","path":"/api/v1/orders/{orderid}/aftersales","audience":"member","idempotent":false,"pathKeys":["orderid"]}));
}

export function createFetchOrderAftersalesApprove(baseUrl: string): OperationMethod<"order.aftersales.approve"> {
  return bindAftersalesApprove(new ApiClient(baseUrl, new FetchTransport()));
}

function bindAftersalesApprove(client: OperationExecutor): OperationMethod<"order.aftersales.approve"> {
  return bindOperation(client, defineStructuralOperation({"id":"order.aftersales.approve","method":"PUT","path":"/api/v1/orders/aftersales/{aftersaleid}/approval","audience":"operator","idempotent":true,"pathKeys":["aftersaleid"]}));
}

export function createFetchOrderAftersalesReject(baseUrl: string): OperationMethod<"order.aftersales.reject"> {
  return bindAftersalesReject(new ApiClient(baseUrl, new FetchTransport()));
}

function bindAftersalesReject(client: OperationExecutor): OperationMethod<"order.aftersales.reject"> {
  return bindOperation(client, defineStructuralOperation({"id":"order.aftersales.reject","method":"DELETE","path":"/api/v1/orders/aftersales/{aftersaleid}/approval","audience":"operator","idempotent":true,"pathKeys":["aftersaleid"]}));
}
