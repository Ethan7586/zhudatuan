import type { Scope } from '@shop/authz';
import { describe, expect, it } from 'vitest';
import type { Actor } from './AccessContext';
import { NodeBoundScopeResolver } from './NodeBoundScopeResolver';

describe('node-bound scope resolver', () => {
  const actor = {} as Actor;
  const scope = { kind: 'mall', id: 'mall:hongtai', path: [] } satisfies Scope;

  it('returns the exact node scope', async () => {
    const resolver = new NodeBoundScopeResolver({ resolve: async () => scope }, scope.id);
    await expect(resolver.resolve(actor, 'catalog.imports.create')).resolves.toBe(scope);
  });

  it('rejects a valid membership scope from another node', async () => {
    const resolver = new NodeBoundScopeResolver({ resolve: async () => ({ ...scope, id: 'mall-zhudatuan' }) }, scope.id);
    await expect(resolver.resolve(actor, 'catalog.imports.create')).rejects.toThrow('NODE_SCOPE_MISMATCH');
  });
});
