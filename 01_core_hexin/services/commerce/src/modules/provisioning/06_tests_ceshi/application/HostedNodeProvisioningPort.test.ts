import { describe, expect, it, vi } from 'vitest';
import { HostedNodeProvisioningPort } from '../../01_public_gongkai/HostedNodeProvisioningPort';

describe('HostedNodeProvisioningPort', () => {
  it('passes one canonical data request to the database generator', async () => {
    const request = {
      idempotency_key: 'hosted-request:test:1',
      node_id: 'node:test-hosted:l6',
      parent_node_id: 'node:test-hosted:l5',
      realm_id: 'realm:test-hosted-l6',
      node_profile: 'operating_mall',
      mall_id: 'mall:test:hosted-l6',
      signed_level: 'L6',
      effective_at: '2026-09-11T00:00:00.000Z',
      requested_by: 'principal:test:operator',
      trace_id: 'trace:test:hosted',
    } as const;
    const query = vi.fn().mockResolvedValue({
      rows: [{
        line_id: 'line:test:hosted',
        node_id: request.node_id,
        sovereignty_tier: 'hosted',
        node_profile: request.node_profile,
        realm_id: request.realm_id,
        mall_id: request.mall_id,
        status: 'active',
        created_at: request.effective_at,
        parent_node_id: request.parent_node_id,
        original_parent_node_id: request.parent_node_id,
        signed_level: request.signed_level,
        host_sovereign_node_id: 'node:test-hosted:l0',
        relation_version: 1,
        effective_at: request.effective_at,
        superseded_at: null,
        idempotency_key: request.idempotency_key,
        request_hash: 'b'.repeat(64),
        requested_by: request.requested_by,
        trace_id: request.trace_id,
        replayed: false,
      }],
    });

    const result = await new HostedNodeProvisioningPort().provision({ query }, request);

    expect(query).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith('select * from organization.provision_hosted_node($1::jsonb)', [JSON.stringify(request)]);
    expect(result).toMatchObject({ node_id: request.node_id, relation_version: 1, replayed: false });
  });
});
