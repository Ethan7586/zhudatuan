// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const PRICING_OPERATION_IDS = Object.freeze([
  "pricing.rules.create",
  "pricing.rules.publish",
] as const satisfies readonly OperationId[]);

export interface PricingOperations {
  readonly rulesCreate: OperationMethod<"pricing.rules.create">;
  readonly rulesPublish: OperationMethod<"pricing.rules.publish">;
}

export function createFetchPricing(baseUrl: string): PricingOperations { return createPricingOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createPricingOperations(client: OperationExecutor): PricingOperations { return Object.freeze({
    rulesCreate: bindRulesCreate(client),
    rulesPublish: bindRulesPublish(client),
  }); }

export function createFetchPricingRulesCreate(baseUrl: string): OperationMethod<"pricing.rules.create"> { return bindRulesCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindRulesCreate(client: OperationExecutor): OperationMethod<"pricing.rules.create"> { return bindOperation(client, defineOperation({"id":"pricing.rules.create","method":"POST","path":"/api/v1/pricing/rules","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchPricingRulesPublish(baseUrl: string): OperationMethod<"pricing.rules.publish"> { return bindRulesPublish(new ApiClient(baseUrl, new FetchTransport())); }

function bindRulesPublish(client: OperationExecutor): OperationMethod<"pricing.rules.publish"> { return bindOperation(client, defineOperation({"id":"pricing.rules.publish","method":"PUT","path":"/api/v1/pricing/rules/{ruleid}/publication","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800})); }
