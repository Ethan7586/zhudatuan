import { VendorClient, type VendorConnection } from '@shop/vendorcore';
import { createJdAuth } from './Auth';

export function createJdClient(connection: VendorConnection, fetcher?: typeof fetch): VendorClient {
  return new VendorClient(connection, createJdAuth(connection.secret), fetcher);
}
