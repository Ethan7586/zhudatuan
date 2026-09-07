import { describe, expect, it, vi } from 'vitest';
import { resolveNodeContextByHost } from '@shop/config/sfl-node-kernel';
import { SERVER_NODE_MANIFEST_REGISTRY } from '../../bootstrap/ApiBootstrap';
import {
  bindRequestNodeContext,
  requireAccessNodeContext,
  requireScopeNodeContext,
  type AccessContext,
} from './AccessContext';
import { PgMembershipResolver, PgScopeResolver, PgSessionResolver } from './PgAccessResolvers';

describe('PostgreSQL access NodeContext continuity', () => {
  it('reuses the request context for session realm, actor, access, and data scope', async () => {
    const nodeContext = resolveNodeContextByHost(SERVER_NODE_MANIFEST_REGISTRY, 'api.hbbtzn.com');
    const headers = bindRequestNodeContext(Object.freeze({ authorization: `Bearer ${'a'.repeat(32)}` }), nodeContext);
    const sessionQuery = vi.fn().mockResolvedValue({
      rows: [{
        actor_id: 'actor:one',
        session_id: 'session:one',
        membership_id: 'membership:one',
        credential_version: 1,
        access_version: 2,
        target: 'console',
        assurance_level: 1,
        assurance_verified_at: null,
      }],
    });
    const actor = await new PgSessionResolver({ query: sessionQuery } as never).resolve(headers);
    const scope = Object.freeze({
      kind: 'mall' as const,
      id: 'mall:d1708f04df2dd8a61736852c4900fb43',
      tenant: 'node:hbbtzn:l1',
      path: [],
    });
    const scopeQuery = vi.fn().mockResolvedValue({ rows: [{ scope }] });
    const resolvedScope = await new PgScopeResolver({ query: scopeQuery } as never)
      .resolve(actor, 'catalog.listings.read');
    const access = { actor, scope: resolvedScope } as AccessContext;

    expect(actor.nodeContext).toBe(nodeContext);
    expect(actor.realm).toBe(nodeContext.realm.ref);
    expect(requireScopeNodeContext(resolvedScope)).toBe(nodeContext);
    expect(requireAccessNodeContext(access)).toBe(nodeContext);
    expect(sessionQuery.mock.calls[0]?.[1]).toHaveLength(1);
  });
});

describe('PgMembershipResolver authorization time snapshot', () => {
  it('returns the database evaluation time with the resolved membership', async () => {
    const evaluatedAt = new Date('2026-08-30T00:00:00.501Z');
    const query = vi.fn().mockResolvedValue({
      rows: [{ id: 'membership:one', active: true, access_version: 7, denies: [], grants: [], evaluated_at: evaluatedAt }],
    });
    const resolver = new PgMembershipResolver({ query } as never);

    await expect(resolver.resolve('membership:one')).resolves.toMatchObject({
      access: { id: 'membership:one', accessVersion: 7 },
      evaluatedAt,
    });
    expect(query.mock.calls[0]?.[0]).toContain('clock_timestamp() evaluated_at');
  });

  it('fails closed when PostgreSQL does not return a valid decision time', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ id: 'membership:one', active: true, access_version: 1, denies: [], grants: [], evaluated_at: 'invalid' }],
    });
    const resolver = new PgMembershipResolver({ query } as never);

    await expect(resolver.resolve('membership:one')).rejects.toThrow('AUTHORIZATION_TIME_INVALID');
  });
});
