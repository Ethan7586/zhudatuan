// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineStructuralOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const PARTNER_OPERATION_IDS = /* @__PURE__ */ Object.freeze([
  "partner.partners.read",
  "partner.partners.manage",
] as const satisfies readonly OperationId[]);

export interface PartnerOperations {
  readonly partnersRead: OperationMethod<"partner.partners.read">;
  readonly partnersManage: OperationMethod<"partner.partners.manage">;
}

export function createFetchPartner(baseUrl: string): PartnerOperations {
  return createPartnerOperations(new ApiClient(baseUrl, new FetchTransport()));
}

export function createPartnerOperations(client: OperationExecutor): PartnerOperations {
  return Object.freeze({
    partnersRead: bindPartnersRead(client),
    partnersManage: bindPartnersManage(client),
  });
}

export function createFetchPartnerPartnersRead(baseUrl: string): OperationMethod<"partner.partners.read"> {
  return bindPartnersRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindPartnersRead(client: OperationExecutor): OperationMethod<"partner.partners.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"partner.partners.read","method":"GET","path":"/api/v1/partners","audience":"operator","idempotent":true,"pathKeys":[]}));
}

export function createFetchPartnerPartnersManage(baseUrl: string): OperationMethod<"partner.partners.manage"> {
  return bindPartnersManage(new ApiClient(baseUrl, new FetchTransport()));
}

function bindPartnersManage(client: OperationExecutor): OperationMethod<"partner.partners.manage"> {
  return bindOperation(client, defineStructuralOperation({"id":"partner.partners.manage","method":"PUT","path":"/api/v1/partners/{partnerid}","audience":"operator","idempotent":true,"pathKeys":["partnerid"]}));
}
