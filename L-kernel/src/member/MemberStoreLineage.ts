import { parseCanonicalTimestamp } from '../node/NodeParsing.ts';
import { parseSflNodeTopology, type NodeRelationRecord, type SflNodeTopology } from '../node/NodeTopology.ts';

/** New ST references an existing MB lineage; neither the MB nor its relations are rewritten. */
export interface MemberStoreLineageReference {
  readonly member_membership_id: string;
  readonly member_node_id: string;
  readonly storefront_node_id: string;
}

export function referencedMemberRelations(
  topology: SflNodeTopology,
  reference: MemberStoreLineageReference,
  at: string,
): readonly NodeRelationRecord[] {
  const parsed = parseSflNodeTopology(topology);
  const instant = parseCanonicalTimestamp(at);
  const active = parsed.relations.filter((relation) => relation.effective_at <= instant
    && (relation.superseded_at === null || instant < relation.superseded_at));
  const children = new Map<string, NodeRelationRecord[]>();
  const byNode = new Map(active.map((relation) => [relation.node_id, relation]));
  for (const relation of active) {
    if (relation.parent_node_id === null) continue;
    const siblings = children.get(relation.parent_node_id) ?? [];
    siblings.push(relation);
    children.set(relation.parent_node_id, siblings);
  }
  if (!byNode.has(reference.member_node_id)) {
    throw new Error(`SFL_NODE_RELATION_NOT_UNIQUE:${reference.member_node_id}:${instant}`);
  }
  const result: NodeRelationRecord[] = [];
  const pending = [reference.member_node_id];
  for (let index = 0; index < pending.length; index += 1) {
    const nodeId = pending[index]!;
    result.push(byNode.get(nodeId)!);
    pending.push(...(children.get(nodeId) ?? []).map((relation) => relation.node_id));
  }
  return Object.freeze(result);
}
