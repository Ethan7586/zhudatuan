// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInput, exactOperationOutput } from '@shop/contract/schema';
import { defineOperation } from '../CatalogOperationDescriptor';

export const MARKETING_OPERATION_IDS = Object.freeze([
  "marketing.campaigns.read",
  "marketing.campaigns.create",
  "marketing.campaigns.revise",
  "marketing.campaigns.publish",
  "marketing.campaigns.disable",
] as const satisfies readonly OperationId[]);

export interface MarketingOperations {
  readonly campaignsRead: OperationMethod<"marketing.campaigns.read">;
  readonly campaignsCreate: OperationMethod<"marketing.campaigns.create">;
  readonly campaignsRevise: OperationMethod<"marketing.campaigns.revise">;
  readonly campaignsPublish: OperationMethod<"marketing.campaigns.publish">;
  readonly campaignsDisable: OperationMethod<"marketing.campaigns.disable">;
}

export const MARKETING_METHOD_BY_OPERATION = Object.freeze({
  "marketing.campaigns.read": "campaignsRead",
  "marketing.campaigns.create": "campaignsCreate",
  "marketing.campaigns.revise": "campaignsRevise",
  "marketing.campaigns.publish": "campaignsPublish",
  "marketing.campaigns.disable": "campaignsDisable",
} as const satisfies Readonly<Record<(typeof MARKETING_OPERATION_IDS)[number], keyof MarketingOperations>>);

export function createFetchMarketing(baseUrl: string): MarketingOperations { return createMarketingOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createMarketingOperations(client: OperationExecutor): MarketingOperations { return Object.freeze({
    campaignsRead: bindCampaignsRead(client),
    campaignsCreate: bindCampaignsCreate(client),
    campaignsRevise: bindCampaignsRevise(client),
    campaignsPublish: bindCampaignsPublish(client),
    campaignsDisable: bindCampaignsDisable(client),
  }); }

export function createFetchMarketingCampaignsRead(baseUrl: string): OperationMethod<"marketing.campaigns.read"> { return bindCampaignsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindCampaignsRead(client: OperationExecutor): OperationMethod<"marketing.campaigns.read"> { return bindOperation(client, defineOperation({ ...{"id":"marketing.campaigns.read","method":"GET","path":"/api/v1/marketing/campaigns","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("MarketingCampaignsReadInput", [] as const, false), output: exactOperationOutput("MarketingCampaignsReadOutput") })); }

export function createFetchMarketingCampaignsCreate(baseUrl: string): OperationMethod<"marketing.campaigns.create"> { return bindCampaignsCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindCampaignsCreate(client: OperationExecutor): OperationMethod<"marketing.campaigns.create"> { return bindOperation(client, defineOperation({ ...{"id":"marketing.campaigns.create","method":"POST","path":"/api/v1/marketing/campaigns","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_DENIED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("MarketingCampaignsCreateInput", [] as const, true), output: exactOperationOutput("MarketingCampaignsCreateOutput") })); }

export function createFetchMarketingCampaignsRevise(baseUrl: string): OperationMethod<"marketing.campaigns.revise"> { return bindCampaignsRevise(new ApiClient(baseUrl, new FetchTransport())); }

function bindCampaignsRevise(client: OperationExecutor): OperationMethod<"marketing.campaigns.revise"> { return bindOperation(client, defineOperation({ ...{"id":"marketing.campaigns.revise","method":"PUT","path":"/api/v1/marketing/campaigns/{campaignid}","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_DENIED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("MarketingCampaignsReviseInput", ["campaignid"] as const, true), output: exactOperationOutput("MarketingCampaignsReviseOutput") })); }

export function createFetchMarketingCampaignsPublish(baseUrl: string): OperationMethod<"marketing.campaigns.publish"> { return bindCampaignsPublish(new ApiClient(baseUrl, new FetchTransport())); }

function bindCampaignsPublish(client: OperationExecutor): OperationMethod<"marketing.campaigns.publish"> { return bindOperation(client, defineOperation({ ...{"id":"marketing.campaigns.publish","method":"PUT","path":"/api/v1/marketing/campaigns/{campaignid}/publication","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_DENIED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("MarketingCampaignsPublishInput", ["campaignid"] as const, true), output: exactOperationOutput("MarketingCampaignsPublishOutput") })); }

export function createFetchMarketingCampaignsDisable(baseUrl: string): OperationMethod<"marketing.campaigns.disable"> { return bindCampaignsDisable(new ApiClient(baseUrl, new FetchTransport())); }

function bindCampaignsDisable(client: OperationExecutor): OperationMethod<"marketing.campaigns.disable"> { return bindOperation(client, defineOperation({ ...{"id":"marketing.campaigns.disable","method":"PUT","path":"/api/v1/marketing/campaigns/{campaignid}/disablement","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_DENIED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("MarketingCampaignsDisableInput", ["campaignid"] as const, true), output: exactOperationOutput("MarketingCampaignsDisableOutput") })); }
