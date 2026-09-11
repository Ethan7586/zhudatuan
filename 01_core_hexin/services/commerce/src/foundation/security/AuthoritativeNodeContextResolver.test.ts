import { describe, expect, it, vi } from 'vitest';
import type { DatabasePool } from '../persistence/Pool';
import { PgAuthoritativeNodeContextResolver, PgNodeScopeResolver } from './AuthoritativeNodeContextResolver';

const persistedContext = Object.freeze({
  line_id: 'line:test:commerce',
  node_id: 'node:test:hosted:l6',
  parent_node_id: 'node:test:hosted:l5',
  signed_level: 'L6',
  sovereignty_tier: 'hosted',
  node_profile: 'consumer',
  realm_id: 'realm:test-hosted-l6',
  mall_id: null,
  host_sovereign_node_id: 'node:test:l0',
  relation_version: 2,
  effective_at: '2026-09-12T00:00:00.000Z',
  status: 'active',
} as const);

describe('authoritative node context and indexed scope resolvers', () => {
  it('accepts only the server target node id and returns persisted authority fields', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [persistedContext] });
    const resolver = new PgAuthoritativeNodeContextResolver({ query } as unknown as DatabasePool);

    await expect(resolver.resolve('node:test:hosted:l6')).resolves.toEqual(persistedContext);
    expect(query).toHaveBeenCalledWith('select * from organization.resolve_node_context($1)', ['node:test:hosted:l6']);
    expect(Object.keys(persistedContext)).not.toEqual(expect.arrayContaining(['manifest_id', 'resource_binding_set_ref', 'secret_binding_set_ref', 'payment_binding_refs', 'release_pointer_ref']));
  });

  it('reads self, ancestors, descendants and subtree through depth-independent closure queries', async () => {
    const row = {
      line_id: persistedContext.line_id,
      node_id: persistedContext.node_id,
      distance: 0,
      relation_version: persistedContext.relation_version,
      effective_at: persistedContext.effective_at,
      status: persistedContext.status,
    };
    const query = vi.fn().mockResolvedValue({ rows: [row] });
    const resolver = new PgNodeScopeResolver({ query } as unknown as DatabasePool);

    await resolver.self(persistedContext);
    await resolver.ancestors(persistedContext);
    await resolver.descendants(persistedContext);
    await resolver.subtree(persistedContext);

    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      'select * from organization.resolve_node_scope_self($1,$2)',
      'select * from organization.resolve_node_scope_ancestors($1,$2)',
      'select * from organization.resolve_node_scope_descendants($1,$2)',
      'select * from organization.resolve_node_scope_subtree($1,$2)',
    ]);
    expect(query.mock.calls.every(([, parameters]) => parameters[0] === persistedContext.line_id && parameters[1] === persistedContext.node_id)).toBe(true);
  });
});
