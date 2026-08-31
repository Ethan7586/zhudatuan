// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const MARKETING_OPERATION_IDS = Object.freeze([
  "marketing.campaigns.read",
] as const satisfies readonly OperationId[]);

export interface MarketingOperations {
  readonly campaignsRead: OperationMethod<"marketing.campaigns.read">;
}

export function createFetchMarketing(baseUrl: string): MarketingOperations { return createMarketingOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createMarketingOperations(client: OperationExecutor): MarketingOperations { return Object.freeze({
    campaignsRead: bindCampaignsRead(client),
  }); }

export function createFetchMarketingCampaignsRead(baseUrl: string): OperationMethod<"marketing.campaigns.read"> { return bindCampaignsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindCampaignsRead(client: OperationExecutor): OperationMethod<"marketing.campaigns.read"> { return bindOperation(client, defineOperation({"id":"marketing.campaigns.read","method":"GET","path":"/api/v1/marketing/campaigns","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }
