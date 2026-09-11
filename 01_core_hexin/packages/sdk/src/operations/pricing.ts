// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineContractOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const PRICING_OPERATION_IDS = /* @__PURE__ */ Object.freeze([
  "pricing.rules.create",
  "pricing.rules.publish",
  "pricing.offers.read",
] as const satisfies readonly OperationId[]);

export interface PricingOperations {
  readonly rulesCreate: OperationMethod<"pricing.rules.create">;
  readonly rulesPublish: OperationMethod<"pricing.rules.publish">;
  readonly offersRead: OperationMethod<"pricing.offers.read">;
}

export function createFetchPricing(baseUrl: string): PricingOperations {
  return createPricingOperations(new ApiClient(baseUrl, new FetchTransport()));
}

export function createPricingOperations(client: OperationExecutor): PricingOperations {
  return Object.freeze({
    rulesCreate: bindRulesCreate(client),
    rulesPublish: bindRulesPublish(client),
    offersRead: bindOffersRead(client),
  });
}

export function createFetchPricingRulesCreate(baseUrl: string): OperationMethod<"pricing.rules.create"> {
  return bindRulesCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindRulesCreate(client: OperationExecutor): OperationMethod<"pricing.rules.create"> {
  return bindOperation(client, defineContractOperation({"id":"pricing.rules.create","method":"POST","path":"/api/v1/pricing/rules","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchPricingRulesPublish(baseUrl: string): OperationMethod<"pricing.rules.publish"> {
  return bindRulesPublish(new ApiClient(baseUrl, new FetchTransport()));
}

function bindRulesPublish(client: OperationExecutor): OperationMethod<"pricing.rules.publish"> {
  return bindOperation(client, defineContractOperation({"id":"pricing.rules.publish","method":"PUT","path":"/api/v1/pricing/rules/{ruleid}/publication","audience":"operator","idempotent":true,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchPricingOffersRead(baseUrl: string): OperationMethod<"pricing.offers.read"> {
  return bindOffersRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindOffersRead(client: OperationExecutor): OperationMethod<"pricing.offers.read"> {
  return bindOperation(client, defineContractOperation({"id":"pricing.offers.read","method":"GET","path":"/api/v1/pricing/offers","audience":"member","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}
