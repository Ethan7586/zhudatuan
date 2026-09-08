// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInputFrom, exactOperationOutputFrom } from '@shop/contract/operationschema';
import { PRICING_BODY_SCHEMAS, PRICING_QUERY_SCHEMAS, PRICING_OUTPUT_SCHEMAS } from '@shop/contract/schema/Pricing';
import { defineOperation } from '../CatalogOperationDescriptor';

export const PRICING_OPERATION_IDS = Object.freeze([
  "pricing.rules.create",
  "pricing.rules.publish",
  "pricing.offers.read",
] as const satisfies readonly OperationId[]);

export interface PricingOperations {
  readonly rulesCreate: OperationMethod<"pricing.rules.create">;
  readonly rulesPublish: OperationMethod<"pricing.rules.publish">;
  readonly offersRead: OperationMethod<"pricing.offers.read">;
}

export const PRICING_METHOD_BY_OPERATION = Object.freeze({
  "pricing.rules.create": "rulesCreate",
  "pricing.rules.publish": "rulesPublish",
  "pricing.offers.read": "offersRead",
} as const satisfies Readonly<Record<(typeof PRICING_OPERATION_IDS)[number], keyof PricingOperations>>);

export function createFetchPricing(baseUrl: string): PricingOperations { return createPricingOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createPricingOperations(client: OperationExecutor): PricingOperations { return Object.freeze({
    rulesCreate: bindRulesCreate(client),
    rulesPublish: bindRulesPublish(client),
    offersRead: bindOffersRead(client),
  }); }

export function createFetchPricingRulesCreate(baseUrl: string): OperationMethod<"pricing.rules.create"> { return bindRulesCreate(new ApiClient(baseUrl, new FetchTransport())); }

export function bindRulesCreate(client: OperationExecutor): OperationMethod<"pricing.rules.create"> { return bindOperation(client, defineOperation({ ...{"id":"pricing.rules.create","method":"POST","path":"/api/v1/pricing/rules","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(PRICING_BODY_SCHEMAS.PricingRulesCreateInput, [] as const, true), output: exactOperationOutputFrom(PRICING_OUTPUT_SCHEMAS.PricingRulesCreateOutput) })); }

export function createFetchPricingRulesPublish(baseUrl: string): OperationMethod<"pricing.rules.publish"> { return bindRulesPublish(new ApiClient(baseUrl, new FetchTransport())); }

export function bindRulesPublish(client: OperationExecutor): OperationMethod<"pricing.rules.publish"> { return bindOperation(client, defineOperation({ ...{"id":"pricing.rules.publish","method":"PUT","path":"/api/v1/pricing/rules/{ruleid}/publication","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInputFrom(PRICING_BODY_SCHEMAS.PricingRulesPublishInput, ["ruleid"] as const, true), output: exactOperationOutputFrom(PRICING_OUTPUT_SCHEMAS.PricingRulesPublishOutput) })); }

export function createFetchPricingOffersRead(baseUrl: string): OperationMethod<"pricing.offers.read"> { return bindOffersRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindOffersRead(client: OperationExecutor): OperationMethod<"pricing.offers.read"> { return bindOperation(client, defineOperation({ ...{"id":"pricing.offers.read","method":"GET","path":"/api/v1/pricing/offers","audience":"public","targets":["console","storefront","miniapp","store","supplier"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(PRICING_QUERY_SCHEMAS.PricingOffersReadInput, [] as const, false), output: exactOperationOutputFrom(PRICING_OUTPUT_SCHEMAS.PricingOffersReadOutput) })); }
