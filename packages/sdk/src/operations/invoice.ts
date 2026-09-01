// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineStructuralOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const INVOICE_OPERATION_IDS = /* @__PURE__ */ Object.freeze([
  "invoice.profiles.manage",
  "invoice.profiles.read",
  "invoice.operatorprofiles.read",
  "invoice.requests.create",
  "invoice.requests.read",
  "invoice.requests.cancel",
  "invoice.requests.decide",
  "invoice.requests.red",
] as const satisfies readonly OperationId[]);

export interface InvoiceOperations {
  readonly profilesManage: OperationMethod<"invoice.profiles.manage">;
  readonly profilesRead: OperationMethod<"invoice.profiles.read">;
  readonly operatorprofilesRead: OperationMethod<"invoice.operatorprofiles.read">;
  readonly requestsCreate: OperationMethod<"invoice.requests.create">;
  readonly requestsRead: OperationMethod<"invoice.requests.read">;
  readonly requestsCancel: OperationMethod<"invoice.requests.cancel">;
  readonly requestsDecide: OperationMethod<"invoice.requests.decide">;
  readonly requestsRed: OperationMethod<"invoice.requests.red">;
}

export function createFetchInvoice(baseUrl: string): InvoiceOperations {
  return createInvoiceOperations(new ApiClient(baseUrl, new FetchTransport()));
}

export function createInvoiceOperations(client: OperationExecutor): InvoiceOperations {
  return Object.freeze({
    profilesManage: bindProfilesManage(client),
    profilesRead: bindProfilesRead(client),
    operatorprofilesRead: bindOperatorprofilesRead(client),
    requestsCreate: bindRequestsCreate(client),
    requestsRead: bindRequestsRead(client),
    requestsCancel: bindRequestsCancel(client),
    requestsDecide: bindRequestsDecide(client),
    requestsRed: bindRequestsRed(client),
  });
}

export function createFetchInvoiceProfilesManage(baseUrl: string): OperationMethod<"invoice.profiles.manage"> {
  return bindProfilesManage(new ApiClient(baseUrl, new FetchTransport()));
}

function bindProfilesManage(client: OperationExecutor): OperationMethod<"invoice.profiles.manage"> {
  return bindOperation(client, defineStructuralOperation({"id":"invoice.profiles.manage","method":"PUT","path":"/api/v1/invoices/profiles/{profileid}","audience":"operator","idempotent":true,"idempotency":"required","expectedVersion":"required","execution":"sync","availability":"runtime","pathKeys":["profileid"]}));
}

export function createFetchInvoiceProfilesRead(baseUrl: string): OperationMethod<"invoice.profiles.read"> {
  return bindProfilesRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindProfilesRead(client: OperationExecutor): OperationMethod<"invoice.profiles.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"invoice.profiles.read","method":"GET","path":"/api/v1/invoices/profiles","audience":"member","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime","pathKeys":[]}));
}

export function createFetchInvoiceOperatorprofilesRead(baseUrl: string): OperationMethod<"invoice.operatorprofiles.read"> {
  return bindOperatorprofilesRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindOperatorprofilesRead(client: OperationExecutor): OperationMethod<"invoice.operatorprofiles.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"invoice.operatorprofiles.read","method":"GET","path":"/api/v1/invoices/operator-profiles","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime","pathKeys":[]}));
}

export function createFetchInvoiceRequestsCreate(baseUrl: string): OperationMethod<"invoice.requests.create"> {
  return bindRequestsCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindRequestsCreate(client: OperationExecutor): OperationMethod<"invoice.requests.create"> {
  return bindOperation(client, defineStructuralOperation({"id":"invoice.requests.create","method":"POST","path":"/api/v1/invoices/requests","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"required","execution":"sync","availability":"runtime","pathKeys":[]}));
}

export function createFetchInvoiceRequestsRead(baseUrl: string): OperationMethod<"invoice.requests.read"> {
  return bindRequestsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindRequestsRead(client: OperationExecutor): OperationMethod<"invoice.requests.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"invoice.requests.read","method":"GET","path":"/api/v1/invoices/requests","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime","pathKeys":[]}));
}

export function createFetchInvoiceRequestsCancel(baseUrl: string): OperationMethod<"invoice.requests.cancel"> {
  return bindRequestsCancel(new ApiClient(baseUrl, new FetchTransport()));
}

function bindRequestsCancel(client: OperationExecutor): OperationMethod<"invoice.requests.cancel"> {
  return bindOperation(client, defineStructuralOperation({"id":"invoice.requests.cancel","method":"DELETE","path":"/api/v1/invoices/requests/{requestid}","audience":"operator","idempotent":true,"idempotency":"required","expectedVersion":"required","execution":"sync","availability":"runtime","pathKeys":["requestid"]}));
}

export function createFetchInvoiceRequestsDecide(baseUrl: string): OperationMethod<"invoice.requests.decide"> {
  return bindRequestsDecide(new ApiClient(baseUrl, new FetchTransport()));
}

function bindRequestsDecide(client: OperationExecutor): OperationMethod<"invoice.requests.decide"> {
  return bindOperation(client, defineStructuralOperation({"id":"invoice.requests.decide","method":"POST","path":"/api/v1/invoices/requests/{requestid}/decide","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"required","execution":"sync","availability":"runtime","pathKeys":["requestid"]}));
}

export function createFetchInvoiceRequestsRed(baseUrl: string): OperationMethod<"invoice.requests.red"> {
  return bindRequestsRed(new ApiClient(baseUrl, new FetchTransport()));
}

function bindRequestsRed(client: OperationExecutor): OperationMethod<"invoice.requests.red"> {
  return bindOperation(client, defineStructuralOperation({"id":"invoice.requests.red","method":"POST","path":"/api/v1/invoices/requests/{requestid}/red","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"required","execution":"sync","availability":"runtime","pathKeys":["requestid"]}));
}
