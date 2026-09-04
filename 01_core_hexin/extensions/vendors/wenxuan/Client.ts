import { VendorClient, type VendorConnection } from '@shop/vendorcore';
import { createWenxuanAuth } from './Auth';

export function createWenxuanClient(connection: VendorConnection, fetcher?: typeof fetch): VendorClient {
  return new VendorClient(connection, createWenxuanAuth(connection.secret), fetcher);
}
