import { describe, expect, it } from 'vitest';
import { buildOpenapi, operationSource, sdkDomainSources, sdkSource, type OperationDefinition } from './ClientArtifacts';

const operations = [
  operation('identity.session.read', 'GET', '/api/v1/identity/session', 'member'),
  operation('catalog.listings.read', 'GET', '/api/v1/catalog/listings', 'public'),
] as const;

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
  });

  it('preserves OMS trace links in contract metadata without creating another operation', () => {
    const traced = { ...operations[0], requirements: ['MVP03', 'OMS-001'] } as const;
    const openapi = JSON.stringify(buildOpenapi([traced], new Map()));
    const source = operationSource([traced], new Map());

    expect(openapi).toContain('OMS-001');
    expect(source).toContain('OMS-001');
    expect(source.match(/identity\.session\.read/g)).toHaveLength(1);
  });
});

function operation(
  id: string,
  method: OperationDefinition['method'],
  path: OperationDefinition['path'],
  audience: OperationDefinition['audience'],
): OperationDefinition {
  return {
    id,
    method,
    path,
    audience,
    owner: id.split('.')[0]!,
    idempotent: true,
    schema: 'structural',
    requirements: ['MVP03'],
    sdk: `packages/sdk/src/operations/${id.split('.')[0]!}.ts`,
  };
}
