import { canonicalCall, canonicalClient, anonymousContext, clearCanonicalSession, rememberCanonicalSession, sessionContext } from './canonicalApiClient';
import { checkoutWithCanonicalPayment } from './canonicalCheckout';
import { mapCanonicalProductPage } from './canonicalCatalogMapper';
import { mapCanonicalAccounts, mapCanonicalCart, mapCanonicalLedgers, mapCanonicalOrders } from './canonicalCommerceMapper';
import { mapCanonicalAddresses, mapCanonicalBootstrap, mapCanonicalSession } from './canonicalIdentityMapper';
import { nextCursor, pageItems, record, text } from './canonicalShape';
import { ProductionApiError } from './productionApi.error';
import type { ApiAccount, ApiAccountLedger, ApiActor, ApiBootstrap, ApiCartItem, ApiDeliveryAddress, ApiHomeSnapshot, ApiOrder, ApiProduct } from './productionApi.types';

export { ProductionApiError } from './productionApi.error';
export type { ApiAccount, ApiAccountLedger, ApiActor, ApiAfterSale, ApiBootstrap, ApiCartItem, ApiDeliveryAddress, ApiHomeSnapshot, ApiOrder, ApiProduct, ApiSecurityCenter, CreateOrderRequest, LoginRequest } from './productionApi.types';

type CatalogOptions = { category?: string; cursor?: string; limit?: number };

async function sessionBootstrap(): Promise<ApiBootstrap> {
  const client = canonicalClient();
  const session = mapCanonicalSession(await canonicalCall(() => client.identity.sessionRead({}, anonymousContext())));
  rememberCanonicalSession(session);
  const profile = await canonicalCall(() => client.member.profileRead({}, sessionContext()));
  return mapCanonicalBootstrap(session, profile);
}

async function accounts(): Promise<ApiAccount[]> {
  const value = await canonicalCall(() => canonicalClient().benefit.accountsRead({ query: { limit: 100 } }, sessionContext()));
  return mapCanonicalAccounts(value);
}

async function ledgers(currentAccounts: readonly ApiAccount[]): Promise<ApiAccountLedger[]> {
  try {
    const value = await canonicalCall(() => canonicalClient().benefit.ledgersRead({ query: { limit: 100 } }, sessionContext()));
    return mapCanonicalLedgers(value, currentAccounts);
  } catch (error) {
    // The canonical contract exists, but the current public WebBusiness
    // allowlist has not exposed it yet. Keep the rest of the account snapshot
    // usable without manufacturing ledger rows.
    if (error instanceof ProductionApiError && error.status === 404) return [];
    throw error;
  }
}

async function orders(): Promise<ApiOrder[]> {
  const items: ApiOrder[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 60; page += 1) {
    const value = await canonicalCall(() => canonicalClient().order.ordersRead({ query: { limit: 100, ...(cursor ? { cursor } : {}) } }, sessionContext()));
    const mapped = mapCanonicalOrders(value);
    items.push(...mapped.items);
    if (!mapped.nextCursor || mapped.nextCursor === cursor) return items;
    cursor = mapped.nextCursor;
  }
  throw new ProductionApiError('订单分页超过安全上限', 502, 'ORDER_PAGE_LIMIT_EXCEEDED');
}

async function inventory(skus: readonly string[]): Promise<{ items: unknown[] }> {
  const items: unknown[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 20; page += 1) {
    const value = await canonicalCall(() => canonicalClient().inventory.availabilityRead({
      query: { sku: skus, limit: 100, ...(cursor ? { cursor } : {}) },
    }, sessionContext()));
    items.push(...pageItems(value, 'inventory.availability'));
    const next = nextCursor(value);
    if (!next || next === cursor) return { items };
    cursor = next;
  }
  throw new ProductionApiError('库存分页超过安全上限', 502, 'INVENTORY_PAGE_LIMIT_EXCEEDED');
}

export const productionApi = {
  async getSession(): Promise<{ authenticated: true; actor: ApiActor }> {
    const bootstrap = await sessionBootstrap();
    return { authenticated: true, actor: bootstrap.actor };
  },

  async logout(): Promise<{ authenticated: false }> {
    try {
      await canonicalCall(() => canonicalClient().identity.sessionDelete({}, sessionContext({ write: true, idempotencyKey: crypto.randomUUID(), includeScope: false })));
      return { authenticated: false };
    } finally {
      clearCanonicalSession();
    }
  },

  async getHomeSnapshot(): Promise<ApiHomeSnapshot> {
    const bootstrap = await sessionBootstrap();
    const [accountItems, orderItems] = await Promise.all([accounts(), orders()]);
    const ledgerItems = await ledgers(accountItems);
    return { bootstrap, accounts: { items: accountItems }, orders: { items: orderItems }, accountLedgers: { items: ledgerItems } };
  },

  async listAccounts(): Promise<{ items: ApiAccount[] }> {
    return { items: await accounts() };
  },

  async listAccountLedgers(): Promise<{ items: ApiAccountLedger[] }> {
    const accountItems = await accounts();
    return { items: await ledgers(accountItems) };
  },

  async listProducts(options: CatalogOptions = {}): Promise<{ items: ApiProduct[]; pagination: { nextCursor: string | null } }> {
    const query = { limit: options.limit ?? 100, ...(options.cursor ? { cursor: options.cursor } : {}), ...(options.category ? { category: options.category } : {}) };
    const listings = await canonicalCall(() => canonicalClient().catalog.listingsRead({ query }, sessionContext()));
    const skus = pageItems(listings, 'catalog.listings').map((item) => text(item.sku_id, 'catalog.listing.sku_id'));
    if (skus.length === 0) return { items: [], pagination: { nextCursor: nextCursor(listings) } };
    const [offerValue, inventoryValue] = await Promise.all([
      canonicalCall(() => canonicalClient().pricing.offersRead({ query: { sku: skus } }, sessionContext())),
      inventory(skus),
    ]);
    return mapCanonicalProductPage(listings, offerValue, inventoryValue);
  },

  async listQualifiedProducts(options: CatalogOptions = {}) {
    return productionApi.listProducts(options);
  },

  async listOrders(): Promise<{ items: ApiOrder[] }> {
    return { items: await orders() };
  },

  async listCart(): Promise<{ items: ApiCartItem[] }> {
    const value = await canonicalCall(() => canonicalClient().cart.currentRead({}, sessionContext()));
    return { items: mapCanonicalCart(value).items };
  },

  async upsertCartItem(input: { listingId: string; quantity: number }): Promise<{ saved: true }> {
    await canonicalCall(() => canonicalClient().cart.itemsPut({ path: { listingid: input.listingId }, body: { quantity: input.quantity } }, sessionContext({
      write: true,
      idempotencyKey: crypto.randomUUID(),
    })));
    return { saved: true };
  },

  async deleteCartItem(listingId: string): Promise<{ removed: true }> {
    await productionApi.upsertCartItem({ listingId, quantity: 0 });
    return { removed: true };
  },

  async listAddresses(): Promise<{ items: ApiDeliveryAddress[] }> {
    const value = await canonicalCall(() => canonicalClient().member.addressesRead({ query: { limit: 100 } }, sessionContext()));
    return { items: mapCanonicalAddresses(value) };
  },

  async upsertAddress(input: ApiDeliveryAddress): Promise<{ id: string }> {
    const id = input.id || `address:${crypto.randomUUID()}`;
    const body = { recipient: input.name, mobile: input.phone, address: input.detail, region: [input.province, input.city, input.district].filter(Boolean).join('/'), status: 'active' };
    const value = await canonicalCall(() => canonicalClient().member.addressesManage({ path: { addressid: id }, body }, sessionContext({
      write: true,
      idempotencyKey: crypto.randomUUID(),
      ...(input.version === undefined ? {} : { expectedVersion: input.version }),
    })));
    return { id: text(record(value, 'member.address.manage').id, 'member.address.manage.id') };
  },

  async deleteAddress(addressId: string, expectedVersion?: number): Promise<{ removed: true }> {
    await canonicalCall(() => canonicalClient().member.addressesManage({ path: { addressid: addressId }, body: { status: 'deleted' } }, sessionContext({
      write: true,
      idempotencyKey: crypto.randomUUID(),
      ...(expectedVersion === undefined ? {} : { expectedVersion }),
    })));
    return { removed: true };
  },

  checkout: checkoutWithCanonicalPayment,
};
