import { describe, expect, it } from 'vitest';
<<<<<<< HEAD
<<<<<<< HEAD
import { buildOpenapi, operationSource, sdkDomainSources, sdkSource, type OperationDefinition } from './ClientArtifacts';
=======
import { sdkDomainSources, sdkSource, type OperationDefinition } from './ClientArtifacts';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import { buildOpenapi, operationSource, sdkDomainSources, sdkSource, type OperationDefinition } from './ClientArtifacts';
>>>>>>> 018b2a71 (chore(release): capture current production source)

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
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)

  it('publishes an explicitly required optimistic version in every contract artifact', () => {
    const reset = { ...operation('identity.members.reset', 'PUT', '/api/v1/identity/members/{membershipid}/registration', 'operator'), expectedVersion: 'required' as const };
    const openapi = JSON.stringify(buildOpenapi([reset], new Map()));

    expect(openapi).toContain('"x-expected-version":"required"');
    expect(operationSource([reset], new Map())).toContain('"required","required"');
  });
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> b9d67316 (feat(requirements): add OMS requirement trace)

  it('preserves OMS trace links in contract metadata without creating another operation', () => {
    const traced = { ...operations[0], requirements: ['MVP03', 'OMS-001'] } as const;
    const openapi = JSON.stringify(buildOpenapi([traced], new Map()));
    const source = operationSource([traced], new Map());

    expect(openapi).toContain('OMS-001');
    expect(source).toContain('OMS-001');
<<<<<<< HEAD
<<<<<<< HEAD
    expect(source.match(/\["identity\.session\.read",/g)).toHaveLength(1);
  });
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
    expect(source.match(/identity\.session\.read/g)).toHaveLength(1);
=======
    expect(source.match(/\["identity\.session\.read",/g)).toHaveLength(1);
>>>>>>> c71368a3 (fix(release): align production generated artifacts)
  });
>>>>>>> b9d67316 (feat(requirements): add OMS requirement trace)
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
