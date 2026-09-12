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

const l1SessionNode = {
  entry_realm_id: 'realm:l1', line_id: 'line:zhudatuan:commerce:v1', node_id: 'node:hbbtzn:l1',
  parent_node_id: 'node:zhudatuan:l0', signed_level: 'L1', node_profile: 'operating_mall',
  mall_id: 'mall:d1708f04df2dd8a61736852c4900fb43', host_sovereign_node_id: 'node:hbbtzn:l1',
} as const;
const l0SessionNode = {
  entry_realm_id: 'realm:l0', line_id: 'line:zhudatuan:commerce:v1', node_id: 'node:zhudatuan:l0',
  parent_node_id: null, signed_level: 'L0', node_profile: 'operating_mall', mall_id: 'mall-zhudatuan',
  host_sovereign_node_id: 'node:zhudatuan:l0',
} as const;

describe('PostgreSQL access NodeContext continuity', () => {
  it('reuses the request context for session realm, actor, access, and data scope', async () => {
    const nodeContext = resolveNodeContextByHost(SERVER_NODE_MANIFEST_REGISTRY, 'api.hbbtzn.com');
    const headers = bindRequestNodeContext(Object.freeze({ authorization: `Bearer ${'a'.repeat(32)}` }), nodeContext);
    const sessionQuery = vi.fn().mockResolvedValue({
      rows: [{
        actor_id: 'actor:one',
        account_id: 'account:l1',
        realm_id: 'realm:l1',
        session_id: 'session:one',
        membership_id: 'membership:one',
        credential_version: 1,
        access_version: 2,
        target: 'console', membership_client: 'operator', governance_organization_id: 'mall:d1708f04df2dd8a61736852c4900fb43',
        assurance_level: 1,
        assurance_verified_at: null,
        ...l1SessionNode,
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

    expect(actor.nodeContext).toMatchObject({ node_id: nodeContext.node_id, realm: { ref: nodeContext.realm.ref } });
    expect(actor.realm).toBe(nodeContext.realm.ref);
    expect(actor.account).toBe('account:l1');
    expect(requireScopeNodeContext(resolvedScope)).toBe(actor.nodeContext);
    expect(requireAccessNodeContext(access)).toBe(actor.nodeContext);
    expect(sessionQuery.mock.calls[0]?.[0]).toContain('actor_id,account_id,realm_id,session_id');
    expect(sessionQuery.mock.calls[0]?.[0]).toContain('identity.resolve_session($1,$2)');
    expect(sessionQuery.mock.calls[0]?.[1]).toEqual([expect.any(String), nodeContext.host]);
  });
});

describe('PgSessionResolver realm account projection', () => {
  it('rejects the legacy session projection instead of consuming an unbound permission context', async () => {
    const nodeContext = resolveNodeContextByHost(SERVER_NODE_MANIFEST_REGISTRY, 'api.hbbtzn.com');
    const missingColumn = Object.assign(new Error('column "entry_realm_id" does not exist'), { code: '42703' });
    const query = vi.fn().mockRejectedValueOnce(missingColumn);
    const headers = bindRequestNodeContext(Object.freeze({ authorization: `Bearer ${'l'.repeat(32)}` }), nodeContext);

    await expect(new PgSessionResolver({ query } as never).resolve(headers)).rejects.toThrow('entry_realm_id');
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('activates the hosted Membership node while retaining the server-resolved entry host', async () => {
    const entryContext = resolveNodeContextByHost(SERVER_NODE_MANIFEST_REGISTRY, 'api.hbbtzn.com');
    const query = vi.fn().mockResolvedValue({ rows: [{
      actor_id: 'principal:shared', account_id: 'account:member-a', realm_id: 'realm:member-a',
      session_id: 'session:member-a', membership_id: 'membership:member-a', credential_version: 2,
      access_version: 4, target: 'storefront', membership_client: 'storefront', governance_organization_id: 'mall:d1708f04df2dd8a61736852c4900fb43', assurance_level: 2, assurance_verified_at: null,
      ...l1SessionNode, node_id: 'node:member-a:l6', parent_node_id: 'node:hbbtzn:l1', signed_level: 'L6',
      node_profile: 'consumer', mall_id: null,
    }] });
    const headers = bindRequestNodeContext(Object.freeze({ authorization: `Bearer ${'m'.repeat(32)}` }), entryContext);

    const actor = await new PgSessionResolver({ query } as never).resolve(headers);
    expect(actor).toMatchObject({
      account: 'account:member-a', realm: 'realm:member-a', membership: 'membership:member-a',
      nodeContext: { host: entryContext.host, line_id: l1SessionNode.line_id, node_id: 'node:member-a:l6',
        parent_node_id: 'node:hbbtzn:l1', signed_level: 'L6', realm: { ref: 'realm:member-a' } },
    });
    const scopeQuery = vi.fn().mockResolvedValue({ rows: [{ scope: {
      kind: 'self', id: 'member:member-a', tenant: 'node:member-a:l6', path: [],
    } }] });
    await new PgScopeResolver({ query: scopeQuery } as never).resolve(actor, 'benefit.balance.read');
    expect(scopeQuery.mock.calls[0]?.[1]).toEqual([
      'membership:member-a', 'realm:member-a', 'storefront',
      'mall:d1708f04df2dd8a61736852c4900fb43', 'benefit.balance.read', null, null,
    ]);
  });

  it('projects the account and realm selected by the database session boundary', async () => {
    const nodeContext = resolveNodeContextByHost(SERVER_NODE_MANIFEST_REGISTRY, 'api.hbbtzn.com');
    const query = vi.fn().mockResolvedValue({ rows: [{
      actor_id: 'principal:shared', account_id: 'account:l1', realm_id: 'realm:l1',
      session_id: 'session:l1', membership_id: 'membership:l1', credential_version: 7,
      access_version: 3, target: 'console', membership_client: 'operator', governance_organization_id: 'mall:d1708f04df2dd8a61736852c4900fb43', assurance_level: 1, assurance_verified_at: null,
      ...l1SessionNode,
    }] });
    const resolver = new PgSessionResolver({ query } as never);
    const headers = bindRequestNodeContext(Object.freeze({ authorization: `Bearer ${'t'.repeat(32)}` }), nodeContext);

    await expect(resolver.resolve(headers)).resolves.toMatchObject({
      id: 'principal:shared', account: 'account:l1', realm: 'realm:l1', nodeContext,
      session: 'session:l1', membership: 'membership:l1', credentialVersion: 7,
    });
    expect(query.mock.calls[0]?.[0]).toContain('actor_id,account_id,realm_id,session_id');
    expect(query.mock.calls[0]?.[0]).toContain('identity.resolve_session($1,$2)');
    expect(query.mock.calls[0]?.[1]?.[1]).toBe('api.hbbtzn.com');
  });

  it('rejects a database session from a different realm than the resolved request node', async () => {
    const nodeContext = resolveNodeContextByHost(SERVER_NODE_MANIFEST_REGISTRY, 'api.hbbtzn.com');
    const query = vi.fn().mockResolvedValue({ rows: [{
      actor_id: 'principal:shared', account_id: 'account:l0', realm_id: 'realm:l0',
      session_id: 'session:l0', membership_id: 'membership:l0', credential_version: 1,
      access_version: 1, target: 'console', membership_client: 'operator', governance_organization_id: 'mall-zhudatuan', assurance_level: 1, assurance_verified_at: null,
      ...l0SessionNode,
    }] });
    const headers = bindRequestNodeContext(Object.freeze({ authorization: `Bearer ${'x'.repeat(32)}` }), nodeContext);

    await expect(new PgSessionResolver({ query } as never).resolve(headers)).rejects.toThrow('AUTH_REALM_MISMATCH');
  });

  it('fails closed when a resolved session has lost its realm or account binding', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{
      actor_id: 'principal:shared', account_id: null, realm_id: 'realm:l0',
      session_id: 'session:l0', membership_id: 'membership:l0', credential_version: 1,
      access_version: 1, target: 'console', membership_client: 'operator', governance_organization_id: 'mall-zhudatuan', assurance_level: 1, assurance_verified_at: null,
      ...l0SessionNode,
    }] });
    const resolver = new PgSessionResolver({ query } as never);
    const headers = bindRequestNodeContext(
      Object.freeze({ authorization: `Bearer ${'t'.repeat(32)}` }),
      resolveNodeContextByHost(SERVER_NODE_MANIFEST_REGISTRY, 'api.fufu.wang'),
    );

    await expect(resolver.resolve(headers))
      .rejects.toThrow('AUTH_REALM_CONTEXT_MISSING');
  });

  it('rejects an L0 cookie on L1 without a write and still accepts it on L0', async () => {
    const query = vi.fn(async (text: string, values: readonly unknown[]) => ({
      rows: values[1] === 'api.fufu.wang' ? [{
        actor_id: 'principal:shared', account_id: 'account:l0', realm_id: 'realm:l0',
        session_id: 'session:l0', membership_id: 'membership:l0', credential_version: 1,
        access_version: 1, target: 'console', membership_client: 'operator', governance_organization_id: 'mall-zhudatuan', assurance_level: 1, assurance_verified_at: null,
        ...l0SessionNode,
      }] : [],
    }));
    const resolver = new PgSessionResolver({ query } as never);
    const cookie = `shop_session=${'t'.repeat(32)}`;

    await expect(resolver.resolve(bindRequestNodeContext(
      Object.freeze({ cookie }), resolveNodeContextByHost(SERVER_NODE_MANIFEST_REGISTRY, 'api.hbbtzn.com'),
    )))
      .rejects.toThrow('AUTHENTICATION_REQUIRED');
    await expect(resolver.resolve(bindRequestNodeContext(
      Object.freeze({ cookie }), resolveNodeContextByHost(SERVER_NODE_MANIFEST_REGISTRY, 'api.fufu.wang'),
    )))
      .resolves.toMatchObject({ account: 'account:l0', realm: 'realm:l0', session: 'session:l0' });
    expect(query.mock.calls.map((call) => call[1]?.[1])).toEqual(['api.hbbtzn.com', 'api.fufu.wang']);
    expect(query.mock.calls.every((call) => call[0].trimStart().startsWith('select '))).toBe(true);
  });
});

describe('PgMembershipResolver authorization time snapshot', () => {
  it('returns the database evaluation time with the resolved membership', async () => {
    const evaluatedAt = new Date('2026-08-30T00:00:00.501Z');
    const query = vi.fn().mockResolvedValue({
      rows: [{ id: 'membership:one', active: true, access_version: 7, denies: [], grants: [], evaluated_at: evaluatedAt }],
    });
    const resolver = new PgMembershipResolver({ query } as never);

    await expect(resolver.resolve('membership:one', { realmId: 'realm:one', client: 'operator', organizationId: 'organization:one' })).resolves.toMatchObject({
      access: { id: 'membership:one', accessVersion: 7 },
      evaluatedAt,
    });
    expect(query.mock.calls[0]?.[0]).toContain('clock_timestamp() evaluated_at');
    expect(query.mock.calls[0]?.[0]).toContain('access.resolve_session_membership($1,$2,$3,$4)');
    expect(query.mock.calls[0]?.[1]).toEqual([
      'membership:one', 'realm:one', 'operator', 'organization:one',
    ]);
  });

  it('fails closed when PostgreSQL does not return a valid decision time', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ id: 'membership:one', active: true, access_version: 1, denies: [], grants: [], evaluated_at: 'invalid' }],
    });
    const resolver = new PgMembershipResolver({ query } as never);

    await expect(resolver.resolve('membership:one', { realmId: 'realm:one', client: 'operator', organizationId: 'organization:one' })).rejects.toThrow('AUTHORIZATION_TIME_INVALID');
  });
});
