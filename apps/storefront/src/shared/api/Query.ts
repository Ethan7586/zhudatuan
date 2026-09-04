export interface StorefrontScopedQueryIdentity {
  readonly client: 'storefront';
  readonly scopeKind: 'mall';
  readonly scopeId: string;
  readonly accessVersion: number;
  readonly resourceVersion: string;
}

export interface StorefrontPublicQueryIdentity {
  readonly client: 'storefront';
  readonly handle: string;
  readonly mall: string;
  readonly releaseVersion: string;
  readonly catalogVersion: string;
}

export interface StorefrontQueryIdentity {
  readonly scoped: StorefrontScopedQueryIdentity;
  readonly public: StorefrontPublicQueryIdentity;
}

const filter = Object.freeze({});

export const StorefrontQuery = Object.freeze({
  bootstrap: (handle: string) => Object.freeze(['storefront', 'bootstrap', handle] as const),
  catalog: (identity: StorefrontPublicQueryIdentity, input: Readonly<Record<string, unknown>> = filter) => publicKey(identity, 'catalog', input),
  product: (identity: StorefrontPublicQueryIdentity, productId: string) => publicKey(identity, 'product', Object.freeze({ productId })),
  profile: (identity: StorefrontScopedQueryIdentity) => scopedKey(identity, 'profile'),
  cart: (identity: StorefrontScopedQueryIdentity) => scopedKey(identity, 'cart'),
  orders: (identity: StorefrontScopedQueryIdentity) => scopedKey(identity, 'orders'),
  order: (identity: StorefrontScopedQueryIdentity, orderId: string) => scopedKey(identity, 'order', Object.freeze({ orderId })),
  addresses: (identity: StorefrontScopedQueryIdentity) => scopedKey(identity, 'addresses'),
  memberships: (identity: StorefrontScopedQueryIdentity) => scopedKey(identity, 'memberships'),
  benefits: (identity: StorefrontScopedQueryIdentity) => scopedKey(identity, 'benefits'),
  aftersale: (identity: StorefrontScopedQueryIdentity, orderId: string) => scopedKey(identity, 'aftersale', Object.freeze({ orderId })),
  favorites: (identity: StorefrontScopedQueryIdentity) => scopedKey(identity, 'favorites'),
  notifications: (identity: StorefrontScopedQueryIdentity) => scopedKey(identity, 'notifications'),
  security: (identity: StorefrontScopedQueryIdentity) => scopedKey(identity, 'security'),
  vouchers: (identity: StorefrontScopedQueryIdentity) => scopedKey(identity, 'vouchers'),
  support: (identity: StorefrontScopedQueryIdentity, caseId?: string) => scopedKey(identity, 'support', Object.freeze({ caseId: caseId ?? 'all' })),
});

function scopedKey(identity: StorefrontScopedQueryIdentity, resource: string, value: Readonly<Record<string, unknown>> = filter) {
  return Object.freeze([identity.client, identity.scopeKind, identity.scopeId, identity.accessVersion, identity.resourceVersion, resource, value] as const);
}

function publicKey(identity: StorefrontPublicQueryIdentity, resource: string, value: Readonly<Record<string, unknown>>) {
  return Object.freeze([identity.client, 'public', identity.handle, identity.mall, identity.releaseVersion, identity.catalogVersion, resource, value] as const);
}
