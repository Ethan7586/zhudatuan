import { describe, expect, it } from 'vitest';
import { parseSflNodeTopology } from '../node/NodeTopology';
import { referencedMemberRelations } from './MemberStoreLineage';

const start = '2026-09-17T00:00:00.000Z';
const changed = '2026-09-18T00:00:00.000Z';
const reference = {
  member_membership_id: 'membership:l1:member',
  member_node_id: 'node:l6',
  storefront_node_id: 'node:new-st:l2',
};

function node(id: string, profile: 'consumer' | 'operating_mall', tier: 'hosted' | 'sovereign') {
  return {
    line_id: 'line:l1', node_id: id, sovereignty_tier: tier, node_profile: profile,
    realm_id: `realm:${id}`, mall_id: profile === 'consumer' ? null : `mall:${id}`,
    status: 'active', created_at: start,
  };
}

function relation(id: string, parent: string | null, level: string) {
  return {
    line_id: 'line:l1', node_id: id, parent_node_id: parent, original_parent_node_id: parent,
    signed_level: level, host_sovereign_node_id: 'node:l0', relation_version: 1,
    effective_at: start, superseded_at: null as string | null,
  };
}

const topology = parseSflNodeTopology({
  schema_version: 'sfl.node-topology.v1',
  nodes: [
    node('node:l0', 'operating_mall', 'sovereign'),
    node('node:new-st:l2', 'operating_mall', 'hosted'),
    node('node:l6', 'consumer', 'hosted'),
    node('node:l7', 'consumer', 'hosted'),
  ],
  relations: [
    relation('node:l0', null, 'L0'),
    relation('node:new-st:l2', 'node:l0', 'L2'),
    relation('node:l6', 'node:l0', 'L6'),
    { ...relation('node:l7', 'node:l6', 'L7'), superseded_at: changed },
    { ...relation('node:l7', 'node:l6', 'L7'), relation_version: 2, effective_at: changed },
  ],
});

describe('MB lineage referenced by a separate ST', () => {
  it('reads the original subtree without reparenting or changing levels', () => {
    const relations = referencedMemberRelations(topology, reference, start);
    expect(relations.map(({ node_id }) => node_id)).toEqual(['node:l6', 'node:l7']);
    expect(relations.map(({ signed_level }) => signed_level)).toEqual(['L6', 'L7']);
    expect(relations[1]?.parent_node_id).toBe('node:l6');
    expect(reference.storefront_node_id).toBe('node:new-st:l2');
    expect(topology.relations.find(({ node_id }) => node_id === 'node:l7')?.parent_node_id).toBe('node:l6');
  });

  it('uses the existing relation version effective at the read time', () => {
    expect(referencedMemberRelations(topology, reference, start)[1]?.relation_version).toBe(1);
    expect(referencedMemberRelations(topology, reference, changed)[1]?.relation_version).toBe(2);
  });
});
