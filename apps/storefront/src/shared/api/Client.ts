import { storefrontClientEnvironment } from '@shop/config/client';
import { createFetchCommerce, type CommerceClient } from '@shop/sdk';
import { requestContext, type RequestOptions, type StorefrontSession } from './Session';
import { currentStorefrontHandle } from '../../route/EntryPath';

export class StorefrontClient {
  readonly commerce: CommerceClient;
  readonly clientVersion: string;

  constructor(environment = storefrontClientEnvironment()) {
    this.commerce = createFetchCommerce(environment.apiOrigin);
    this.clientVersion = environment.clientVersion;
  }

  context(session: StorefrontSession | null, options: RequestOptions = {}) {
    return requestContext(this.clientVersion, currentStorefrontHandle(), session, options);
  }
}

export const storefrontClient = new StorefrontClient();
