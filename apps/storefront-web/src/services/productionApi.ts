<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
import { canonicalCall, canonicalClient, anonymousContext, clearCanonicalSession, rememberCanonicalSession, sessionContext } from './canonicalApiClient';
import { checkoutWithCanonicalBenefits } from './canonicalCheckout';
import { mapCanonicalProductPage } from './canonicalCatalogMapper';
import { mapCanonicalAccounts, mapCanonicalCart, mapCanonicalLedgers, mapCanonicalOrders } from './canonicalCommerceMapper';
import { mapCanonicalAddresses, mapCanonicalBootstrap, mapCanonicalSession } from './canonicalIdentityMapper';
import { nextCursor, pageItems, record, text } from './canonicalShape';
import { ProductionApiError } from './productionApi.error';
import type { ApiAccount, ApiAccountLedger, ApiActor, ApiBootstrap, ApiCartItem, ApiDeliveryAddress, ApiHomeSnapshot, ApiOrder, ApiProduct } from './productionApi.types';
<<<<<<< HEAD

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

<<<<<<< HEAD
  checkoutWithInternalBenefits: checkoutWithCanonicalBenefits,
=======
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
/**
 * 生产数据访问层。
 *
 * 所有生产业务数据均通过同源服务端 API 访问，浏览器不接触数据库密钥。
 */
import type { ApiAccount, ApiAccountLedger, ApiActor, ApiAfterSale, ApiBootstrap, ApiCartItem, ApiDeliveryAddress, ApiHomeSnapshot, ApiOrder, ApiProduct, ApiSecurityCenter, CreateOrderRequest, LoginRequest } from './productionApi.types';
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)

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

<<<<<<< HEAD
=======

export type { ApiAccount, ApiAccountLedger, ApiActor, ApiAfterSale, ApiBootstrap, ApiCartItem, ApiDeliveryAddress, ApiHomeSnapshot, ApiOrder, ApiProduct, ApiSecurityCenter, CreateOrderRequest, LoginRequest } from './productionApi.types';

interface ErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
  };
}

export class ProductionApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly requestId?: string
  ) {
    super(message);
    this.name = 'ProductionApiError';
  }
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  if (init.body) {
    headers.set('content-type', 'application/json');
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: 'same-origin',
  });
  const isJson = (response.headers.get('content-type') ?? '').includes('application/json');
  if (!isJson) {
    throw new ProductionApiError(response.ok ? '服务响应格式异常' : `服务请求失败（${response.status}）`, response.status, 'NON_JSON_RESPONSE');
  }
  const body = (await response.json()) as T | ErrorEnvelope;
  if (!response.ok) {
    const error = (body as ErrorEnvelope).error;
    throw new ProductionApiError(error?.message ?? '服务请求失败', response.status, error?.code ?? 'UNKNOWN_API_ERROR', error?.requestId);
  }
  return body as T;
}

export const productionApi = {
  async getHealth(): Promise<{
    status: string;
    checks: {
      database: string;
      authentication: string;
      piiEncryption: string;
    };
    database: { provider: string; region: string };
  }> {
    return apiFetch('/api/health');
  },

  async getSession(): Promise<{ authenticated: true; actor: ApiActor }> {
    return apiFetch('/api/v1/auth/session');
  },

  async login(credentials: LoginRequest): Promise<{ authenticated: true; actor: ApiActor }> {
    return apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  async logout(): Promise<{ authenticated: false }> {
    return apiFetch('/api/v1/auth/logout', { method: 'POST' });
  },
  async getSecurityCenter(): Promise<ApiSecurityCenter> {
    return apiFetch('/api/v1/auth/security-center');
  },
  async changePassword(input: { currentPassword: string; newPassword: string }): Promise<{ changed: true }> {
    return apiFetch('/api/v1/auth/password/change', { method: 'POST', body: JSON.stringify(input) });
  },
  async requestSecurityOtp(input: { mobile: string; purpose: 'phone_change' | 'password_reset' }): Promise<{ challengeId: string; debugCode?: string }> {
    return apiFetch('/api/v1/auth/security/otp', { method: 'POST', body: JSON.stringify(input) });
  },
  async changePhone(input: { newMobile: string; challengeId: string; code: string; currentPassword: string }): Promise<{ changed: true }> {
    return apiFetch('/api/v1/auth/phone/change', { method: 'POST', body: JSON.stringify(input) });
  },
  async revokeSession(sessionId: string): Promise<{ revoked: true; currentSession: boolean }> {
    return apiFetch(`/api/v1/auth/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
  },
  async revokeOtherSessions(): Promise<{ revokedCount: number }> {
    return apiFetch('/api/v1/auth/sessions/revoke-others', { method: 'POST' });
  },

  async getBootstrap(): Promise<ApiBootstrap> {
    return apiFetch('/api/v1/bootstrap');
  },

  async getHomeSnapshot(): Promise<ApiHomeSnapshot> {
    return apiFetch('/api/v1/home');
  },

  async listAccounts(): Promise<{ items: ApiAccount[] }> {
    return apiFetch('/api/v1/accounts');
  },

  async listAccountLedgers(): Promise<{ items: ApiAccountLedger[] }> {
    return apiFetch('/api/v1/account-ledgers');
  },

  async listAfterSales(): Promise<{ items: ApiAfterSale[] }> {
    return apiFetch('/api/v1/after-sales');
  },

  async createAfterSale(input: { orderId: string; type: ApiAfterSale['type']; reason: string; requestedAmountCents: number }): Promise<{ afterSale: ApiAfterSale }> {
    return apiFetch('/api/v1/after-sales', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async listProducts(options: { category?: string; cursor?: number; limit?: number } = {}): Promise<{ items: ApiProduct[]; pagination: { nextCursor: number | null } }> {
    const query = new URLSearchParams();
    if (options.category) query.set('category', options.category);
    if (options.cursor !== undefined) query.set('cursor', String(options.cursor));
    if (options.limit !== undefined) query.set('limit', String(options.limit));
    return apiFetch(`/api/v1/catalog/public/products?${query.toString()}`);
  },

  async listQualifiedProducts(options: { category?: string; cursor?: number; limit?: number } = {}): Promise<{ items: ApiProduct[]; pagination: { nextCursor: number | null } }> {
    const query = new URLSearchParams();
    if (options.category) query.set('category', options.category);
    if (options.cursor !== undefined) query.set('cursor', String(options.cursor));
    if (options.limit !== undefined) query.set('limit', String(options.limit));
    return apiFetch(`/api/v1/products?${query.toString()}`);
  },

  async listOrders(): Promise<{ items: ApiOrder[] }> {
    return apiFetch('/api/v1/orders');
  },

  async listCart(): Promise<{ items: ApiCartItem[] }> {
    return apiFetch('/api/v1/cart');
  },

  async upsertCartItem(input: { skuId: string; quantity: number; selected: boolean }): Promise<{ item: ApiCartItem }> {
    return apiFetch('/api/v1/cart', { method: 'PUT', body: JSON.stringify(input) });
  },

  async deleteCartItem(cartItemId: string): Promise<{ removed: true }> {
    return apiFetch(`/api/v1/cart/${encodeURIComponent(cartItemId)}`, { method: 'DELETE' });
  },
  async listAddresses(): Promise<{ items: ApiDeliveryAddress[] }> {
    return apiFetch('/api/v1/addresses');
  },
  async upsertAddress(input: ApiDeliveryAddress): Promise<{ id: string }> {
    return apiFetch('/api/v1/addresses', { method: 'PUT', body: JSON.stringify(input) });
  },
  async deleteAddress(addressId: string): Promise<{ removed: true }> {
    return apiFetch(`/api/v1/addresses/${encodeURIComponent(addressId)}`, { method: 'DELETE' });
  },

  async createOrder(input: CreateOrderRequest, idempotencyKey: string): Promise<{ order: ApiOrder }> {
    return apiFetch('/api/v1/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(input),
    });
  },

>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  async payWithInternalAccounts(
    orderId: string,
    allocation: { welfareCents: number; mealCents: number },
    idempotencyKey: string
  ): Promise<{
    payment: {
      orderId: string;
      status: string;
      amountCents: number;
      completedAt: string;
    };
  }> {
    return apiFetch(`/api/v1/orders/${encodeURIComponent(orderId)}/payments/internal`, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(allocation),
    });
  },
<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  checkoutWithInternalBenefits: checkoutWithCanonicalBenefits,
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  async startPaymentPhoneVerification(): Promise<{ challengeId: string; expiresAt: string }> {
    const value = record(await canonicalCall(() => canonicalClient().identity.stepupStart({ body: {} }, sessionContext({
      write: true,
      idempotencyKey: crypto.randomUUID(),
    }))), 'identity.stepup.start');
    return {
      challengeId: text(value.id, 'identity.stepup.start.id'),
      expiresAt: text(value.expires_at, 'identity.stepup.start.expires_at'),
    };
  },

  async completePaymentPhoneVerification(challengeId: string, code: string): Promise<{ verified: true }> {
    await canonicalCall(() => canonicalClient().identity.stepupComplete({ body: { challenge: challengeId, code } }, sessionContext({
      write: true,
      idempotencyKey: crypto.randomUUID(),
    })));
    return { verified: true };
  },

  checkout: checkoutWithCanonicalPayment,
>>>>>>> 9b9c8f8d (fix(storefront): complete L6 checkout entry)
};
