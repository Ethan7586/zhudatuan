// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const ORDER_OPERATION_IDS = Object.freeze([
  "order.orders.create",
  "order.orders.read",
  "order.reminders.create",
  "order.orders.export",
  "order.aftersales.read",
  "order.aftersales.apply",
  "order.aftersales.approve",
  "order.aftersales.reject",
  "order.orders.receive",
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
  readonly ordersReceive: OperationMethod<"order.orders.receive">;
}

export function createFetchOrder(baseUrl: string): OrderOperations { return createOrderOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createOrderOperations(client: OperationExecutor): OrderOperations { return Object.freeze({
    ordersCreate: bindOrdersCreate(client),
    ordersRead: bindOrdersRead(client),
    remindersCreate: bindRemindersCreate(client),
    ordersExport: bindOrdersExport(client),
    aftersalesRead: bindAftersalesRead(client),
    aftersalesApply: bindAftersalesApply(client),
    aftersalesApprove: bindAftersalesApprove(client),
    aftersalesReject: bindAftersalesReject(client),
    ordersReceive: bindOrdersReceive(client),
  }); }

export function createFetchOrderOrdersCreate(baseUrl: string): OperationMethod<"order.orders.create"> { return bindOrdersCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindOrdersCreate(client: OperationExecutor): OperationMethod<"order.orders.create"> { return bindOperation(client, defineOperation({"id":"order.orders.create","method":"POST","path":"/api/v1/orders","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchOrderOrdersRead(baseUrl: string): OperationMethod<"order.orders.read"> { return bindOrdersRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindOrdersRead(client: OperationExecutor): OperationMethod<"order.orders.read"> { return bindOperation(client, defineOperation({"id":"order.orders.read","method":"GET","path":"/api/v1/orders","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchOrderRemindersCreate(baseUrl: string): OperationMethod<"order.reminders.create"> { return bindRemindersCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindRemindersCreate(client: OperationExecutor): OperationMethod<"order.reminders.create"> { return bindOperation(client, defineOperation({"id":"order.reminders.create","method":"POST","path":"/api/v1/orders/{orderid}/reminders","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchOrderOrdersExport(baseUrl: string): OperationMethod<"order.orders.export"> { return bindOrdersExport(new ApiClient(baseUrl, new FetchTransport())); }

function bindOrdersExport(client: OperationExecutor): OperationMethod<"order.orders.export"> { return bindOperation(client, defineOperation({"id":"order.orders.export","method":"POST","path":"/api/v1/orders/exports","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchOrderAftersalesRead(baseUrl: string): OperationMethod<"order.aftersales.read"> { return bindAftersalesRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindAftersalesRead(client: OperationExecutor): OperationMethod<"order.aftersales.read"> { return bindOperation(client, defineOperation({"id":"order.aftersales.read","method":"GET","path":"/api/v1/orders/aftersales","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchOrderAftersalesApply(baseUrl: string): OperationMethod<"order.aftersales.apply"> { return bindAftersalesApply(new ApiClient(baseUrl, new FetchTransport())); }

function bindAftersalesApply(client: OperationExecutor): OperationMethod<"order.aftersales.apply"> { return bindOperation(client, defineOperation({"id":"order.aftersales.apply","method":"POST","path":"/api/v1/orders/{orderid}/aftersales","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchOrderAftersalesApprove(baseUrl: string): OperationMethod<"order.aftersales.approve"> { return bindAftersalesApprove(new ApiClient(baseUrl, new FetchTransport())); }

function bindAftersalesApprove(client: OperationExecutor): OperationMethod<"order.aftersales.approve"> { return bindOperation(client, defineOperation({"id":"order.aftersales.approve","method":"PUT","path":"/api/v1/orders/aftersales/{aftersaleid}/approval","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchOrderAftersalesReject(baseUrl: string): OperationMethod<"order.aftersales.reject"> { return bindAftersalesReject(new ApiClient(baseUrl, new FetchTransport())); }

function bindAftersalesReject(client: OperationExecutor): OperationMethod<"order.aftersales.reject"> { return bindOperation(client, defineOperation({"id":"order.aftersales.reject","method":"DELETE","path":"/api/v1/orders/aftersales/{aftersaleid}/approval","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchOrderOrdersReceive(baseUrl: string): OperationMethod<"order.orders.receive"> { return bindOrdersReceive(new ApiClient(baseUrl, new FetchTransport())); }

function bindOrdersReceive(client: OperationExecutor): OperationMethod<"order.orders.receive"> { return bindOperation(client, defineOperation({"id":"order.orders.receive","method":"POST","path":"/api/v1/orders/{orderid}/receive","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":true,"timeout":800})); }
