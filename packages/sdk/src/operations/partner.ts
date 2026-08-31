// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineStructuralOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const PARTNER_OPERATION_IDS = /* @__PURE__ */ Object.freeze([
  "partner.partners.read",
  "partner.partners.manage",
  "partner.customers.create",
  "partner.customers.update",
  "partner.customers.enable",
  "partner.customers.disable",
  "partner.customers.get",
  "partner.customers.list",
  "partner.customeroptions.list",
] as const satisfies readonly OperationId[]);

export interface PartnerOperations {
  readonly partnersRead: OperationMethod<"partner.partners.read">;
  readonly partnersManage: OperationMethod<"partner.partners.manage">;
  readonly customersCreate: OperationMethod<"partner.customers.create">;
  readonly customersUpdate: OperationMethod<"partner.customers.update">;
  readonly customersEnable: OperationMethod<"partner.customers.enable">;
  readonly customersDisable: OperationMethod<"partner.customers.disable">;
  readonly customersGet: OperationMethod<"partner.customers.get">;
  readonly customersList: OperationMethod<"partner.customers.list">;
  readonly customeroptionsList: OperationMethod<"partner.customeroptions.list">;
}

export function createFetchPartner(baseUrl: string): PartnerOperations {
  return createPartnerOperations(new ApiClient(baseUrl, new FetchTransport()));
}

export function createPartnerOperations(client: OperationExecutor): PartnerOperations {
  return Object.freeze({
    partnersRead: bindPartnersRead(client),
    partnersManage: bindPartnersManage(client),
    customersCreate: bindCustomersCreate(client),
    customersUpdate: bindCustomersUpdate(client),
    customersEnable: bindCustomersEnable(client),
    customersDisable: bindCustomersDisable(client),
    customersGet: bindCustomersGet(client),
    customersList: bindCustomersList(client),
    customeroptionsList: bindCustomeroptionsList(client),
  });
}

export function createFetchPartnerPartnersRead(baseUrl: string): OperationMethod<"partner.partners.read"> {
  return bindPartnersRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindPartnersRead(client: OperationExecutor): OperationMethod<"partner.partners.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"partner.partners.read","method":"GET","path":"/api/v1/partners","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime","pathKeys":[]}));
}

export function createFetchPartnerPartnersManage(baseUrl: string): OperationMethod<"partner.partners.manage"> {
  return bindPartnersManage(new ApiClient(baseUrl, new FetchTransport()));
}

function bindPartnersManage(client: OperationExecutor): OperationMethod<"partner.partners.manage"> {
  return bindOperation(client, defineStructuralOperation({"id":"partner.partners.manage","method":"PUT","path":"/api/v1/partners/{partnerid}","audience":"operator","idempotent":true,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime","pathKeys":["partnerid"]}));
}

export function createFetchPartnerCustomersCreate(baseUrl: string): OperationMethod<"partner.customers.create"> {
  return bindCustomersCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindCustomersCreate(client: OperationExecutor): OperationMethod<"partner.customers.create"> {
  return bindOperation(client, defineStructuralOperation({"id":"partner.customers.create","method":"POST","path":"/api/v1/partners/customers","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"none","execution":"sync","availability":"frozen","pathKeys":[]}));
}

export function createFetchPartnerCustomersUpdate(baseUrl: string): OperationMethod<"partner.customers.update"> {
  return bindCustomersUpdate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindCustomersUpdate(client: OperationExecutor): OperationMethod<"partner.customers.update"> {
  return bindOperation(client, defineStructuralOperation({"id":"partner.customers.update","method":"PATCH","path":"/api/v1/partners/customers/{customerid}","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"required","execution":"sync","availability":"frozen","pathKeys":["customerid"]}));
}

export function createFetchPartnerCustomersEnable(baseUrl: string): OperationMethod<"partner.customers.enable"> {
  return bindCustomersEnable(new ApiClient(baseUrl, new FetchTransport()));
}

function bindCustomersEnable(client: OperationExecutor): OperationMethod<"partner.customers.enable"> {
  return bindOperation(client, defineStructuralOperation({"id":"partner.customers.enable","method":"POST","path":"/api/v1/partners/customers/{customerid}/enable","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"required","execution":"sync","availability":"frozen","pathKeys":["customerid"]}));
}

export function createFetchPartnerCustomersDisable(baseUrl: string): OperationMethod<"partner.customers.disable"> {
  return bindCustomersDisable(new ApiClient(baseUrl, new FetchTransport()));
}

function bindCustomersDisable(client: OperationExecutor): OperationMethod<"partner.customers.disable"> {
  return bindOperation(client, defineStructuralOperation({"id":"partner.customers.disable","method":"POST","path":"/api/v1/partners/customers/{customerid}/disable","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"required","execution":"sync","availability":"frozen","pathKeys":["customerid"]}));
}

export function createFetchPartnerCustomersGet(baseUrl: string): OperationMethod<"partner.customers.get"> {
  return bindCustomersGet(new ApiClient(baseUrl, new FetchTransport()));
}

function bindCustomersGet(client: OperationExecutor): OperationMethod<"partner.customers.get"> {
  return bindOperation(client, defineStructuralOperation({"id":"partner.customers.get","method":"GET","path":"/api/v1/partners/customers/{customerid}","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"frozen","pathKeys":["customerid"]}));
}

export function createFetchPartnerCustomersList(baseUrl: string): OperationMethod<"partner.customers.list"> {
  return bindCustomersList(new ApiClient(baseUrl, new FetchTransport()));
}

function bindCustomersList(client: OperationExecutor): OperationMethod<"partner.customers.list"> {
  return bindOperation(client, defineStructuralOperation({"id":"partner.customers.list","method":"GET","path":"/api/v1/partners/customers","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"frozen","pathKeys":[]}));
}

export function createFetchPartnerCustomeroptionsList(baseUrl: string): OperationMethod<"partner.customeroptions.list"> {
  return bindCustomeroptionsList(new ApiClient(baseUrl, new FetchTransport()));
}

function bindCustomeroptionsList(client: OperationExecutor): OperationMethod<"partner.customeroptions.list"> {
  return bindOperation(client, defineStructuralOperation({"id":"partner.customeroptions.list","method":"GET","path":"/api/v1/partners/customer-options","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"frozen","pathKeys":[]}));
}
