/**
 * 生产数据访问层。
 *
 * 所有生产业务数据均通过同源服务端 API 访问，浏览器不接触数据库密钥。
 */
import type { ApiAccount, ApiAccountLedger, ApiActor, ApiAfterSale, ApiBootstrap, ApiCartItem, ApiDeliveryAddress, ApiHomeSnapshot, ApiOrder, ApiProduct, ApiSecurityCenter, CreateOrderRequest, LoginRequest } from './productionApi.types';

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
};
