// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineContractOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const MARKETING_OPERATION_IDS = /* @__PURE__ */ Object.freeze([
  "marketing.campaigns.read",
] as const satisfies readonly OperationId[]);

export interface MarketingOperations {
  readonly campaignsRead: OperationMethod<"marketing.campaigns.read">;
}

export function createFetchMarketing(baseUrl: string): MarketingOperations {
  return createMarketingOperations(new ApiClient(baseUrl, new FetchTransport()));
}

export function createMarketingOperations(client: OperationExecutor): MarketingOperations {
  return Object.freeze({
    campaignsRead: bindCampaignsRead(client),
  });
}

export function createFetchMarketingCampaignsRead(baseUrl: string): OperationMethod<"marketing.campaigns.read"> {
  return bindCampaignsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindCampaignsRead(client: OperationExecutor): OperationMethod<"marketing.campaigns.read"> {
  return bindOperation(client, defineContractOperation({"id":"marketing.campaigns.read","method":"GET","path":"/api/v1/marketing/campaigns","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}
