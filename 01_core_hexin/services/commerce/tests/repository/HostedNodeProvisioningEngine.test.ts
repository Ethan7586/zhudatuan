import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { HostedNodeProvisioningRequest } from '@shop/config/sfl-node-kernel';
import { HostedNodeProvisioningPort } from '../../src/modules/provisioning/HostedNodeProvisioningPort';

const runtimeConnection = process.env.SHOP_TEST_DATABASE_URL;
const adminConnection = process.env.SHOP_TEST_ADMIN_DATABASE_URL;
const endpointAvailable = runtimeConnection !== undefined && adminConnection !== undefined;

describe.runIf(endpointAvailable)('SFL hosted node provisioning engine', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  const rootNodeId = 'node:zhudatuan:l0';
  const effectiveAt = '2026-09-11T00:00:00.000Z';
  const admin = new Client({ connectionString: adminConnection });
  const port = new HostedNodeProvisioningPort();

  beforeAll(async () => {
    await admin.connect();
  });

  afterAll(async () => {
    await admin.end();
  });

  it('collapses five concurrent copies and repeated calls into one fact set', async () => {
    const request = await operatingRequest('concurrent', 5, rootNodeId);
    const results = await Promise.all(Array.from({ length: 5 }, () => transact(request)));

    expect(results.filter((result) => !result.replayed)).toHaveLength(1);
    expect(results.filter((result) => result.replayed)).toHaveLength(4);
    await expectFactCounts(request.node_id, 1, 1, 1);

    const replay = await transact(request);
    expect(replay.replayed).toBe(true);
    await expectFactCounts(request.node_id, 1, 1, 1);

    await expect(transact({ ...request, trace_id: `${request.trace_id}:changed` }))
      .rejects.toThrow('SFL_HOSTED_NODE_IDEMPOTENCY_KEY_REUSED');
    await expectFactCounts(request.node_id, 1, 1, 1);
  });

  it('rolls back an injected post-node failure and retries to one complete fact set', async () => {
    const request = await operatingRequest('rollback', 5, rootNodeId);
    await admin.query(`create function pg_temp.reject_hosted_relation_fixture()
      returns trigger language plpgsql as $body$ begin
        if new.node_id=$q$${request.node_id}$q$ then raise exception 'HOSTED_RELATION_FIXTURE_INTERRUPTED'; end if;
        return new;
      end $body$`);
    await admin.query(`create trigger reject_hosted_relation_fixture before insert on organization.noderelation
      for each row execute function pg_temp.reject_hosted_relation_fixture()`);

    await expect(transact(request)).rejects.toThrow('HOSTED_RELATION_FIXTURE_INTERRUPTED');
    await expectFactCounts(request.node_id, 0, 0, 0);
    await admin.query('drop trigger reject_hosted_relation_fixture on organization.noderelation');

    const result = await transact(request);
    expect(result).toMatchObject({ node_id: request.node_id, relation_version: 1, replayed: false });
    await expectFactCounts(request.node_id, 1, 1, 1);
  });

  it('lets only one idempotency key claim a contested node id', async () => {
    const first = await consumerRequest('rival', 6, rootNodeId);
    const second = { ...first, idempotency_key: `${first.idempotency_key}:second`, trace_id: `${first.trace_id}:second` };
    const settled = await Promise.allSettled([transact(first), transact(second)]);

    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = settled.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(String(rejected?.reason)).toContain('SFL_HOSTED_NODE_ID_CONFLICT');
    await expectFactCounts(first.node_id, 1, 1, 1);
  });

  async function operatingRequest(label: string, level: number, parentNodeId: string): Promise<HostedNodeProvisioningRequest> {
    const nodeId = `node:hosted-it-${suffix}-${label}:l${level}`;
    const realmId = `realm:hosted-${suffix}-${label}`;
    const mallId = `mall:hosted:${suffix}:${label}`;
    await seedRealm(realmId, nodeId, 'operating_mall', mallId);
    return Object.freeze({
      idempotency_key: `hosted-it:${suffix}:${label}`,
      node_id: nodeId,
      parent_node_id: parentNodeId,
      realm_id: realmId,
      node_profile: 'operating_mall',
      mall_id: mallId,
      signed_level: `L${level}`,
      effective_at: effectiveAt,
      requested_by: 'principal:integration:hosted-provisioner',
      trace_id: `trace:hosted-it:${suffix}:${label}`,
    });
  }

  async function consumerRequest(label: string, level: number, parentNodeId: string): Promise<HostedNodeProvisioningRequest> {
    const nodeId = `node:hosted-it-${suffix}-${label}:l${level}`;
    const realmId = `realm:hosted-${suffix}-${label}`;
    await seedRealm(realmId, nodeId, 'consumer', null);
    return Object.freeze({
      idempotency_key: `hosted-it:${suffix}:${label}`,
      node_id: nodeId,
      parent_node_id: parentNodeId,
      realm_id: realmId,
      node_profile: 'consumer',
      mall_id: null,
      signed_level: `L${level}`,
      effective_at: effectiveAt,
      requested_by: 'principal:integration:hosted-provisioner',
      trace_id: `trace:hosted-it:${suffix}:${label}`,
    });
  }

  async function seedRealm(realmId: string, nodeId: string, profile: 'operating_mall' | 'consumer', mallId: string | null) {
    await admin.query(`insert into identity.realm(
      id,node_id,status,node_profile,mall_id,host_node_id,host_node_profile,created_at,updated_at
    ) values($1,$2,'active',$3,$4,$5,$6,$7,$7)`, [
      realmId,
      nodeId,
      profile,
      mallId,
      profile === 'consumer' ? rootNodeId : null,
      profile === 'consumer' ? 'operating_mall' : null,
      effectiveAt,
    ]);
  }

  async function transact(request: HostedNodeProvisioningRequest) {
    const client = new Client({ connectionString: runtimeConnection });
    await client.connect();
    try {
      await client.query('begin');
      const result = await port.provision({
        query: (text, values) => client.query(text, values === undefined ? [] : [...values]),
      }, request);
      await client.query('commit');
      return result;
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      await client.end();
    }
  }

  async function expectFactCounts(nodeId: string, nodes: number, relations: number, requests: number) {
    const result = await admin.query<{ nodes: string; relations: string; requests: string }>(`select
      (select count(*) from organization.node where id=$1)::text nodes,
      (select count(*) from organization.noderelation where node_id=$1)::text relations,
      (select count(*) from organization.hostednodeprovisioning where node_id=$1)::text requests`, [nodeId]);
    expect(result.rows[0]).toEqual({ nodes: String(nodes), relations: String(relations), requests: String(requests) });
  }
});
