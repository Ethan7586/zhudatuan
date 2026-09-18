import { describe, expect, it } from 'vitest';
import { parseHostedMallOpeningRequest, parseHostedMallOpeningResult } from './HostedMallOpening';

describe('original hosted mall opening rules in L-kernel', () => {
  it('accepts only the business request, leaving authority to the existing session', () => {
    const request = {
      idempotency_key: 'opening:fixture', mall_name: '测试商城', operating_entity_name: '测试经营主体',
    };
    expect(parseHostedMallOpeningRequest(request)).toEqual(request);
    expect(() => parseHostedMallOpeningRequest({ ...request, node_id: 'node:forged' }))
      .toThrow('SFL_HOSTED_MALL_OPENING_REQUEST_INVALID');
  });

  it('retains the original versioned result projection', () => {
    const opened = parseHostedMallOpeningResult({
      opening_id: 'opening:fixture', business_number: 'SFLMALL-FIXTURE', idempotency_key: 'opening:fixture',
      request_hash: 'd'.repeat(64), node_id: 'node:member:l8', membership_id: 'membership:member',
      principal_id: 'principal:member', mall_id: 'mall:member', operating_entity_id: 'enterprise:member',
      realm_id: 'realm:member-l8', line_id: 'line:fixture', signed_level: 'L8', parent_node_id: 'node:parent:l7',
      original_parent_node_id: 'node:parent:l7', host_sovereign_node_id: 'node:host:l0', sovereignty_tier: 'hosted',
      node_profile: 'operating_mall', capabilities: ['consumer', 'operating_mall'], capability_version: 2,
      relation_version: 1, mall_version: 1, entity_binding_version: 1, configuration_version: 1,
      payment_configuration_version: 1, status: 'active', opened_at: '2026-09-01T00:00:00.000Z', replayed: false,
    });
    expect(opened).toMatchObject({ node_id: 'node:member:l8', signed_level: 'L8', capability_version: 2 });
  });
});
