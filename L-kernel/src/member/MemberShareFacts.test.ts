import { describe, expect, it } from 'vitest';
import { memberShareMarks, type MemberShareFact } from './MemberShareFacts';

const sharedAt = '2026-09-17T00:00:00.000Z';
const revokedAt = '2026-09-18T00:00:00.000Z';
const chosen: MemberShareFact = {
  source_st_node_id: 'node:l1', recipient_st_node_id: 'node:l2a',
  member_membership_id: 'membership:l1:chosen', shared_at: sharedAt, revoked_at: null,
};

describe('optional fixed-list MB sharing facts', () => {
  it('marks the same original Membership in both ST directories', () => {
    expect(memberShareMarks([chosen], 'node:l1', sharedAt)).toEqual([{
      member_membership_id: 'membership:l1:chosen', side: 'shared_out', counterpart_st_node_id: 'node:l2a',
    }]);
    expect(memberShareMarks([chosen], 'node:l2a', sharedAt)).toEqual([{
      member_membership_id: 'membership:l1:chosen', side: 'shared_in', counterpart_st_node_id: 'node:l1',
    }]);
    expect(memberShareMarks([chosen], 'node:unrelated', sharedAt)).toEqual([]);
  });

  it('does not include an unselected or later-registered MB', () => {
    expect(memberShareMarks([chosen], 'node:l2a', sharedAt).map((mark) => mark.member_membership_id))
      .toEqual(['membership:l1:chosen']);
  });

  it('stops current annotations when the source withdraws the share', () => {
    const withdrawn = { ...chosen, revoked_at: revokedAt };
    expect(memberShareMarks([withdrawn], 'node:l2a', sharedAt)).toHaveLength(1);
    expect(memberShareMarks([withdrawn], 'node:l1', revokedAt)).toEqual([]);
    expect(memberShareMarks([withdrawn], 'node:l2a', revokedAt)).toEqual([]);
  });
});
