import { ApiClient } from './ApiClient';
import { FetchTransport } from './FetchTransport';
import type { ClientSurface } from '@shop/contract';
import type { Transport } from './Transport';
import { WechatTransport, type WechatRequester } from './WechatTransport';
import { createCommerceClient, type CommerceClient } from './operations/CommerceClient';
import { createSurfaceClient, type MiniappSurfaceClient, type SurfaceClientMap } from './SurfaceCatalog';
import { createMiniappClient } from './MiniappClient';

export function createFetchCommerce(baseUrl: string): CommerceClient {
  return createCommerce(baseUrl, new FetchTransport());
}

export function createWechatCommerce(baseUrl: string, requester: WechatRequester): CommerceClient {
  return createCommerce(baseUrl, new WechatTransport(requester));
}

export function createFetchSurface<TSurface extends ClientSurface>(surface: TSurface, baseUrl: string): SurfaceClientMap[TSurface] {
  return createSurfaceClient(surface, new ApiClient(baseUrl, new FetchTransport()));
}

export function createWechatSurface(baseUrl: string, requester: WechatRequester): MiniappSurfaceClient {
  return createMiniappClient(new ApiClient(baseUrl, new WechatTransport(requester)));
}

export function createCommerce(baseUrl: string, transport: Transport): CommerceClient {
  return createCommerceClient(new ApiClient(baseUrl, transport));
}
