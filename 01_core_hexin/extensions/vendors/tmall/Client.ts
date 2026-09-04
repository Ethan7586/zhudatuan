import { VendorClient, type VendorConnection } from '@shop/vendorcore';
import { createTmallAuth } from './Auth';

export function createTmallClient(connection: VendorConnection, fetcher?: typeof fetch): VendorClient {
  return new VendorClient(connection, createTmallAuth(connection.secret), fetcher);
}
