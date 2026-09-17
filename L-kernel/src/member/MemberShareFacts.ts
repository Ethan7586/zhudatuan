import { parseCanonicalTimestamp } from '../node/NodeParsing';

/** One explicitly selected MB identity shared from its owning ST; no future MB is implied. */
export interface MemberShareFact {
  readonly source_st_node_id: string;
  readonly recipient_st_node_id: string;
  readonly member_membership_id: string;
  readonly shared_at: string;
  readonly revoked_at: string | null;
}

export interface MemberShareMark {
  readonly member_membership_id: string;
  readonly side: 'shared_out' | 'shared_in';
  readonly counterpart_st_node_id: string;
}

/** Both directories derive their annotations from the same active share facts. */
export function memberShareMarks(
  facts: readonly MemberShareFact[],
  viewerStNodeId: string,
  at: string,
): readonly MemberShareMark[] {
  const instant = parseCanonicalTimestamp(at);
  return Object.freeze(facts.flatMap((fact): MemberShareMark[] => {
    const sharedAt = parseCanonicalTimestamp(fact.shared_at);
    const revokedAt = fact.revoked_at === null ? null : parseCanonicalTimestamp(fact.revoked_at);
    if (sharedAt > instant || (revokedAt !== null && instant >= revokedAt)) return [];
    if (fact.source_st_node_id === viewerStNodeId) return [{
      member_membership_id: fact.member_membership_id,
      side: 'shared_out',
      counterpart_st_node_id: fact.recipient_st_node_id,
    }];
    if (fact.recipient_st_node_id === viewerStNodeId) return [{
      member_membership_id: fact.member_membership_id,
      side: 'shared_in',
      counterpart_st_node_id: fact.source_st_node_id,
    }];
    return [];
  }));
}
