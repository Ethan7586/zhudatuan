import { describe, expect, it } from 'vitest';
import { parseSflNodeTopology, resolveNodeRecord } from './NodeTopology';

const start = '2026-09-01T00:00:00.000Z';
const change = '2026-09-10T00:00:00.000Z';
const root = {
  line_id: 'line:test', node_id: 'node:l0', sovereignty_tier: 'sovereign',
  node_profile: 'operating_mall', realm_id: 'realm:l0', mall_id: 'mall:l0',
  status: 'active', created_at: start,
};
const member = {
  line_id: 'line:test', node_id: 'node:l6', sovereignty_tier: 'hosted',
  node_profile: 'consumer', realm_id: 'realm:l6', mall_id: null,
  status: 'active', created_at: start,
};
const rootRelation = {
  line_id: 'line:test', node_id: 'node:l0', parent_node_id: null,
  original_parent_node_id: null, signed_level: 'L0', host_sovereign_node_id: 'node:l0',
  relation_version: 1, effective_at: start, superseded_at: null,
};
const memberRelation = {
  line_id: 'line:test', node_id: 'node:l6', parent_node_id: 'node:l0',
  original_parent_node_id: 'node:l0', signed_level: 'L6', host_sovereign_node_id: 'node:l0',
  relation_version: 1, effective_at: start, superseded_at: change,
};
const topology = {
  schema_version: 'sfl.node-topology.v1',
  nodes: [root, member],
  relations: [rootRelation, memberRelation, { ...memberRelation, relation_version: 2, effective_at: change, superseded_at: null }],
};

describe('original node relation topology in L-kernel', () => {
  it('resolves the original and current relation version at their boundaries', () => {
    const parsed = parseSflNodeTopology(topology);
    expect(resolveNodeRecord(parsed, 'node:l6', start).relation_version).toBe(1);
    expect(resolveNodeRecord(parsed, 'node:l6', change).relation_version).toBe(2);
  });

  it('retains the original overlap rejection', () => {
    const overlapping = {
      ...topology,
      relations: [rootRelation, { ...memberRelation, superseded_at: null }, topology.relations[2]],
    };
    expect(() => parseSflNodeTopology(overlapping)).toThrow('SFL_NODE_RELATION_PERIOD_OVERLAP');
  });

  it('retains the original parent and level boundary', () => {
    const invalid = {
      ...topology,
      relations: [rootRelation, { ...memberRelation, signed_level: 'L7' }],
    };
    expect(() => parseSflNodeTopology(invalid)).toThrow('SFL_NODE_RELATION_LEVEL_INVALID');
  });
});
