import { VendorClient, type VendorConnection } from '@shop/vendorcore';
import { createCakeuncleAuth } from './Auth';

export function createCakeuncleClient(connection: VendorConnection, fetcher?: typeof fetch): VendorClient {
  return new VendorClient(connection, createCakeuncleAuth(connection.secret), fetcher);
}
