import { ApiClient } from './ApiClient';
import { FetchTransport } from './FetchTransport';
import type { Transport } from './Transport';
import { WechatTransport, type WechatRequester } from './WechatTransport';
import { createCommerceClient, type CommerceClient } from './operations/CommerceClient.generated';

export function createFetchCommerce(baseUrl: string): CommerceClient {
  return createCommerce(baseUrl, new FetchTransport());
}

export function createWechatCommerce(baseUrl: string, requester: WechatRequester): CommerceClient {
  return createCommerce(baseUrl, new WechatTransport(requester));
}

export function createCommerce(baseUrl: string, transport: Transport): CommerceClient {
  return createCommerceClient(new ApiClient(baseUrl, transport));
}
