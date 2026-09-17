import { describe, expect, it } from 'vitest';
import { parseHostedNodeProvisioningRequest, parseHostedNodeProvisioningResult } from './HostedNodeProvisioning';

const request = {
  idempotency_key: 'hosted-request:fixture', node_id: 'node:fixture:l5', parent_node_id: 'node:fixture:l0',
  realm_id: 'realm:fixture:l5', node_profile: 'consumer', mall_id: null, signed_level: 'L5',
  effective_at: '2026-09-01T00:00:00.000Z', requested_by: 'principal:fixture', trace_id: 'trace:fixture',
} as const;

describe('original hosted node provisioning rules in L-kernel', () => {
  it('retains the existing request projection and level boundary', () => {
    expect(parseHostedNodeProvisioningRequest(request)).toEqual(request);
    expect(() => parseHostedNodeProvisioningRequest({ ...request, signed_level: 'L1' }))
      .toThrow('SFL_L1_REQUIRES_SOVEREIGN');
    expect(() => parseHostedNodeProvisioningRequest({ ...request, parent_node_id: request.node_id }))
      .toThrow('SFL_HOSTED_NODE_PARENT_INVALID');
  });

  it('retains the persisted node and relation projection', () => {
    const result = parseHostedNodeProvisioningResult({
      line_id: 'line:fixture', node_id: request.node_id, sovereignty_tier: 'hosted',
      node_profile: 'consumer', realm_id: request.realm_id, mall_id: null,
      status: 'active', created_at: request.effective_at,
      parent_node_id: request.parent_node_id, original_parent_node_id: request.parent_node_id,
      signed_level: request.signed_level, host_sovereign_node_id: 'node:fixture:l0',
      relation_version: 1, effective_at: request.effective_at, superseded_at: null,
      idempotency_key: request.idempotency_key, request_hash: 'a'.repeat(64),
      requested_by: request.requested_by, trace_id: request.trace_id, replayed: true,
    });
    expect(result).toMatchObject({ node_id: request.node_id, relation_version: 1, replayed: true });
  });
});
