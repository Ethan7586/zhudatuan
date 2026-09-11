import { randomUUID } from 'node:crypto';
import type { HostedNodeProvisioningRequest } from '@shop/config/sfl-node-kernel';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DatabasePool } from '../../src/foundation/persistence/Pool';
import { PgAuthoritativeNodeContextResolver, PgNodeScopeResolver } from '../../src/foundation/security/AuthoritativeNodeContextResolver';
import { HostedNodeProvisioningPort } from '../../src/modules/provisioning/HostedNodeProvisioningPort';

const runtimeConnection = process.env.SHOP_TEST_DATABASE_URL;
const adminConnection = process.env.SHOP_TEST_ADMIN_DATABASE_URL;
const endpointAvailable = runtimeConnection !== undefined && adminConnection !== undefined;

describe.runIf(endpointAvailable)('SFL NodeContext and Scope Resolver engine', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  const rootNodeId = 'node:zhudatuan:l0';
  const sovereignL1NodeId = 'node:hbbtzn:l1';
  const effectiveAt = '2026-09-12T00:00:00.000Z';
  const changedAt = '2026-09-12T01:00:00.000Z';
  const admin = new Client({ connectionString: adminConnection });
  const runtime = new Client({ connectionString: runtimeConnection });
  const runtimePool = {
    query: (text: string, values?: readonly unknown[]) => runtime.query(text, values === undefined ? [] : [...values]),
  } as unknown as DatabasePool;
  const contextResolver = new PgAuthoritativeNodeContextResolver(runtimePool);
  const scopeResolver = new PgNodeScopeResolver(runtimePool);
  const provisioning = new HostedNodeProvisioningPort();
  const nodes = new Map<number, string>();

  beforeAll(async () => {
    await admin.connect();
    await runtime.connect();
    let parentNodeId = rootNodeId;
    for (const level of [1, 5, 6, 7, 8, 9, 10, 11]) {
      const nodeId = `node:context-it-${suffix}:l${level}`;
      const profile = level === 1 || level === 5 ? 'operating_mall' : 'consumer';
      const mallId = profile === 'operating_mall' ? `mall:context:${suffix}:l${level}` : null;
      const realmId = `realm:context-${suffix}-l${level}`;
      await admin.query(
        `insert into identity.realm(
        id,node_id,status,node_profile,mall_id,host_node_id,host_node_profile,created_at,updated_at
      ) values($1,$2,'active',$3,$4,$5,$6,$7,$7)`,
        [realmId, nodeId, profile, mallId, profile === 'consumer' ? rootNodeId : null, profile === 'consumer' ? 'operating_mall' : null, effectiveAt]
      );
      const request: HostedNodeProvisioningRequest = {
        idempotency_key: `context-it:${suffix}:l${level}`,
        node_id: nodeId,
        parent_node_id: parentNodeId,
        realm_id: realmId,
        node_profile: profile,
        mall_id: mallId,
        signed_level: `L${level}`,
        effective_at: effectiveAt,
        requested_by: 'principal:integration:context-resolver',
        trace_id: `trace:context-it:${suffix}:l${level}`,
      };
      await provisioning.provision({ query: runtimePool.query.bind(runtimePool) }, request);
      nodes.set(level, nodeId);
      parentNodeId = nodeId;
    }
  });

  afterAll(async () => {
    await runtime.end();
    await admin.end();
  });

  it('resolves sovereign and hosted profiles through one authoritative implementation', async () => {
    const contexts = await Promise.all([
      contextResolver.resolve(rootNodeId),
      contextResolver.resolve(sovereignL1NodeId),
      contextResolver.resolve(node(1)),
      contextResolver.resolve(node(5)),
      contextResolver.resolve(node(6)),
      contextResolver.resolve(node(11)),
    ]);

    expect(contexts.map((context) => [context.signed_level, context.sovereignty_tier, context.node_profile])).toEqual([
      ['L0', 'sovereign', 'operating_mall'],
      ['L1', 'sovereign', 'operating_mall'],
      ['L1', 'hosted', 'operating_mall'],
      ['L5', 'hosted', 'operating_mall'],
      ['L6', 'hosted', 'consumer'],
      ['L11', 'hosted', 'consumer'],
    ]);
    expect(contexts.slice(2).every((context) => context.host_sovereign_node_id === rootNodeId)).toBe(true);
    expect(contexts[3]?.realm_id).not.toBe(contexts[4]?.realm_id);
    expect(contexts[3]?.node_id).not.toBe(contexts[4]?.node_id);
    expect(Object.keys(contexts[4]!)).not.toEqual(
      expect.arrayContaining(['manifest_id', 'manifest_digest', 'resource_binding_set_ref', 'secret_binding_set_ref', 'payment_binding_refs', 'release_pointer_ref', 'domain_bindings', 'runtime_instance_id'])
    );
  });

  it('ignores forged authority fields because the resolver accepts only the server target node id', async () => {
    const forgedClientPayload = {
      target_node_id: node(6),
      line_id: 'line:forged',
      realm_id: 'realm:forged',
      parent_node_id: sovereignL1NodeId,
      host_sovereign_node_id: sovereignL1NodeId,
      relation_version: 999,
      node_profile: 'operating_mall',
    } as const;

    await expect(contextResolver.resolve(forgedClientPayload.target_node_id)).resolves.toMatchObject({
      line_id: 'line:zhudatuan:commerce:v1',
      realm_id: `realm:context-${suffix}-l6`,
      parent_node_id: node(5),
      host_sovereign_node_id: rootNodeId,
      relation_version: 1,
      node_profile: 'consumer',
    });
  });

  it('reads self, ancestors, descendants and subtree directly from current closure facts', async () => {
    const l11 = await contextResolver.resolve(node(11));
    const root = await contextResolver.resolve(rootNodeId);
    const l5 = await contextResolver.resolve(node(5));

    await expect(scopeResolver.self(l11)).resolves.toMatchObject([{ node_id: node(11), distance: 0 }]);
    const ancestors = await scopeResolver.ancestors(l11);
    expect(ancestors).toHaveLength(8);
    expect(ancestors[0]).toMatchObject({ node_id: node(10), distance: 1 });
    expect(ancestors.at(-1)).toMatchObject({ node_id: rootNodeId, distance: 8 });
    const descendants = await scopeResolver.descendants(root);
    expect(descendants.filter((entry) => entry.node_id.includes(suffix))).toHaveLength(8);
    await expect(scopeResolver.subtree(l5)).resolves.toHaveLength(7);
  });

  it('keeps old relations and closure history while resolving only the new current version', async () => {
    await admin.query(
      `update organization.noderelation set superseded_at=$1
      where line_id='line:zhudatuan:commerce:v1' and node_id=$2 and relation_version=1`,
      [changedAt, node(6)]
    );
    await admin.query(
      `insert into organization.noderelation(
      line_id,node_id,parent_node_id,original_parent_node_id,signed_level,host_sovereign_node_id,relation_version,effective_at
    ) values('line:zhudatuan:commerce:v1',$1,$2,$3,'L6',$2,2,$4)`,
      [node(6), rootNodeId, node(5), changedAt]
    );

    await expect(contextResolver.resolve(node(6))).resolves.toMatchObject({
      parent_node_id: rootNodeId,
      relation_version: 2,
      effective_at: changedAt,
    });
    const history = await admin.query(
      `select relation_version,parent_node_id,superseded_at is null current
      from organization.noderelation where node_id=$1 order by relation_version`,
      [node(6)]
    );
    expect(history.rows).toEqual([
      { relation_version: '1', parent_node_id: node(5), current: false },
      { relation_version: '2', parent_node_id: rootNodeId, current: true },
    ]);
    const l11 = await contextResolver.resolve(node(11));
    expect((await scopeResolver.ancestors(l11)).some((entry) => entry.node_id === node(5))).toBe(false);

    await admin.query('update organization.node set status=$1,updated_at=$2 where id=$3', ['suspended', changedAt, node(11)]);
    await expect(contextResolver.resolve(node(11))).resolves.toMatchObject({ status: 'suspended' });
  });

  function node(level: number): string {
    const nodeId = nodes.get(level);
    if (!nodeId) throw new Error(`NODE_FIXTURE_MISSING:${level}`);
    return nodeId;
  }
});
