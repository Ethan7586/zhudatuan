import { describe, expect, it } from 'vitest';
import { sdkBrowserClientSources, sdkDomainSources, sdkMiniappSource, sdkSource, sdkSurfaceSource, surfaceSource, type ClientDefinition, type OperationDefinition } from './ClientArtifacts';

const operations = [operation('identity.session.read', 'GET', '/api/v1/identity/session', 'storefront'), operation('catalog.listings.read', 'GET', '/api/v1/catalog/listings', 'storefront')] as const;

describe('SDK client artifacts', () => {
  it('emits one independent domain with named domain and Operation factories', () => {
    const identity = sdkDomainSources(operations).get('identity');

    expect(identity).toContain('createFetchIdentity(');
    expect(identity).toContain('createFetchIdentitySessionRead(');
    expect(identity).toContain('identity.session.read');
    expect(identity).not.toContain('catalog.listings.read');
  });

  it('never makes a generated client depend on the global runtime catalog or schema map', () => {
    const artifacts = [sdkSource(operations), ...sdkDomainSources(operations).values()];

    for (const source of artifacts) {
      expect(source).not.toContain('OperationCatalog');
      expect(source).not.toContain('OPERATION_SCHEMAS');
      expect(source).not.toContain('call<T');
    }
    expect(artifacts.join('\n')).toContain('exactOperationInput');
    expect(artifacts.join('\n')).toContain('errorUnion');
  });

  it('generates target-isolated surface clients and a restricted miniapp transport policy', () => {
    const source = sdkSurfaceSource(clients, operations);

    expect(surfaceSource(clients)).toContain('"miniapp"');
    expect(source).toContain('createSurfaceClient');
    expect(source).toContain('MINIAPP_TRANSPORT_POLICY');
    expect(source).toContain('StorefrontSurfaceClient');
    expect(sdkMiniappSource(clients, operations)).toContain('bindIdentitySessionRead(executor)');
    expect(sdkMiniappSource(clients, operations)).not.toContain('createCommerceClient');
    const storefront = sdkBrowserClientSources(clients, operations).get('StorefrontClient');
    expect(storefront).toContain('createFetchStorefront');
    expect(storefront).toContain('bindIdentitySessionRead(executor)');
    expect(storefront).toContain('bindCatalogListingsRead(executor)');
    expect(storefront).not.toContain('createCommerceClient');
  });
});

const clients: readonly ClientDefinition[] = [
  { id: 'auth', title: '身份中心', workspace: '@shop/auth', path: 'apps/auth', audience: 'public', domains: ['identity'], target: null, transport: 'browser', route: 'auth', localPort: 3002 },
  { id: 'console', title: '控制台', workspace: '@shop/console', path: 'apps/console', audience: 'console', domains: [], target: 'console', transport: 'browser', route: 'console', localPort: 4173 },
  { id: 'storefront', title: '商城', workspace: '@shop/storefront', path: 'apps/storefront', audience: 'storefront', domains: [], target: 'storefront', transport: 'browser', route: 'storefront', localPort: 3000 },
  { id: 'miniapp', title: '小程序', workspace: '@shop/miniapp', path: 'apps/miniapp', audience: 'storefront', domains: [], target: 'miniapp', transport: 'wechat', route: 'miniapp', localPort: 4174 },
  { id: 'store', title: '门店', workspace: '@shop/store', path: 'apps/store', audience: 'console', domains: [], target: 'store', transport: 'browser', route: 'store', localPort: 4175 },
  { id: 'supplier', title: '供应商', workspace: '@shop/supplier', path: 'apps/supplier', audience: 'console', domains: [], target: 'supplier', transport: 'browser', route: 'supplier', localPort: 4176 },
];

function operation(id: string, method: OperationDefinition['method'], path: OperationDefinition['path'], audience: OperationDefinition['audience']): OperationDefinition {
  return {
    id,
    version: 1,
    title: id,
    method,
    path,
    audience,
    targets: audience === 'public' ? ['console', 'storefront', 'miniapp', 'store', 'supplier'] : audience === 'storefront' ? ['storefront', 'miniapp'] : audience === 'console' ? ['console'] : [],
    owner: id.split('.')[0]!,
    permission: null,
    capability: id,
    scopeKinds: ['self'],
    assuranceLevel: 'session',
    makerChecker: false,
    originPolicy: 'none',
    csrfPolicy: 'none',
    responseMode: 'json',
    cachePolicy: 'none',
    targetPolicy: 'exact',
    idempotencyPolicy: 'none',
    requestSchema: `${id.replaceAll('.', '')}Request`,
    responseSchema: `${id.replaceAll('.', '')}Response`,
    errorUnion: ['INTERNAL_ERROR'],
    idempotencyScope: 'none',
    expectedVersion: 'none',
    timeout: 1_000,
    rateClass: 'read',
    risk: 'low',
    concurrencyPolicy: 'none',
    executionMode: 'sync',
    auditLevel: 'basic',
    sensitiveFields: [],
    lifecycle: 'active',
    resourceResolver: 'none',
    resourceParameter: null,
    idempotent: true,
    requirements: ['MVPPLATFORM'],
    controller: 'HttpApp',
    handler: `services/commerce/src/modules/${id.split('.')[0]!}/application/handler/TestHandler.ts`,
    sdk: `packages/sdk/src/operations/${id.split('.')[0]!}.ts`,
  };
}
