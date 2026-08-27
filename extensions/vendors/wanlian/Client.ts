import { VendorClient, type VendorConnection } from '@shop/vendorcore';
import { createWanlianAuth } from './Auth';

export function createWanlianClient(connection: VendorConnection, fetcher?: typeof fetch): VendorClient {
  return new VendorClient(connection, createWanlianAuth(connection.secret), fetcher);
}
