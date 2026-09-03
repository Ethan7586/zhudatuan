import { describe, expect, it } from 'vitest';
import { sdkDomainSources, sdkSource, type OperationDefinition } from './ClientArtifacts';

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
});

function operation(id: string, method: OperationDefinition['method'], path: OperationDefinition['path'], audience: OperationDefinition['audience']): OperationDefinition {
  return {
    id,
    method,
    path,
    audience,
    targets: audience === 'public' ? ['console', 'storefront'] : audience === 'console' || audience === 'storefront' ? [audience] : [],
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
    resourceResolver: 'none',
    resourceParameter: null,
    idempotent: true,
    requirements: ['MVPPLATFORM'],
    controller: 'HttpApp',
    handler: `services/commerce/src/modules/${id.split('.')[0]!}/application/handler/TestHandler.ts`,
    sdk: `packages/sdk/src/operations/${id.split('.')[0]!}.ts`,
  };
}
