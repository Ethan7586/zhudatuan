import { storefrontClientEnvironment } from '@shop/config/client';
import { createFetchCommerce, type CommerceClient } from '@shop/sdk';
import { requestContext, type RequestOptions, type StorefrontSession } from './Session';

export class StorefrontClient {
  readonly commerce: CommerceClient;
  readonly clientVersion: string;

  constructor(environment = storefrontClientEnvironment()) {
    this.commerce = createFetchCommerce(environment.apiOrigin);
    this.clientVersion = environment.clientVersion;
  }

  context(session: StorefrontSession | null, options: RequestOptions = {}) {
    return requestContext(this.clientVersion, session, options);
  }
}

export const storefrontClient = new StorefrontClient();
