import { describe, expect, it } from 'vitest';
import { allocateMemberSuffixes, allocateStorefrontSegment, formatMemberIdentityCode } from './MemberIdentityCode';

const st = 'node:hbbtzn:l1';

describe('MB 4+4 identity code rules', () => {
  it('keeps fixed vectors, length and the unambiguous alphabet', () => {
    const prefix = allocateStorefrontSegment(st, null, new Set());
    const suffixes = allocateMemberSuffixes(st, ['membership:b', 'membership:a'], new Map(), new Set());
    expect(prefix).toBe('QS1K');
    expect(suffixes.get('membership:a')).toBe('JR6R');
    expect(suffixes.get('membership:b')).toBe('NA8Q');
    expect(formatMemberIdentityCode(prefix, suffixes.get('membership:a')!)).toBe('MB-QS1KJR6R');
    expect(prefix).toMatch(/^[0-9A-HJKMNP-Z]{4}$/);
  });

  it('reassigns a colliding segment without changing a prior assignment', () => {
    const original = allocateStorefrontSegment(st, null, new Set());
    const replacement = allocateStorefrontSegment(st, null, new Set([original]));
    expect(replacement).not.toBe(original);
    expect(allocateStorefrontSegment(st, original, new Set([original, replacement]))).toBe(original);

    const first = allocateMemberSuffixes(st, ['membership:a'], new Map(), new Set());
    const occupied = new Set([first.get('membership:a')!]);
    const reassigned = allocateMemberSuffixes(st, ['membership:a'], new Map(), occupied);
    expect(reassigned.get('membership:a')).not.toBe(first.get('membership:a'));
    expect(allocateMemberSuffixes(st, ['membership:a', 'membership:b'], first, occupied).get('membership:a'))
      .toBe(first.get('membership:a'));
  });

  it('keeps retired segments reserved and makes each full code distinct', () => {
    const prefix = allocateStorefrontSegment(st, null, new Set());
    const otherPrefix = allocateStorefrontSegment('node:other:l2', null, new Set([prefix]));
    const suffixes = allocateMemberSuffixes(st, ['membership:a', 'membership:b'], new Map(), new Set());
    expect(new Set(suffixes.values()).size).toBe(2);
    expect(formatMemberIdentityCode(prefix, suffixes.get('membership:a')!))
      .not.toBe(formatMemberIdentityCode(otherPrefix, suffixes.get('membership:a')!));
    const retired = new Set([suffixes.get('membership:a')!]);
    expect(allocateMemberSuffixes(st, ['membership:a'], new Map(), retired).get('membership:a'))
      .not.toBe(suffixes.get('membership:a'));
  });

  it('rejects malformed display segments', () => {
    expect(() => formatMemberIdentityCode('OP-7K2M', 'JR6R')).toThrow('MB_IDENTITY_CODE_SEGMENT_INVALID');
    expect(() => formatMemberIdentityCode('QS1K', 'O0IL')).toThrow('MB_IDENTITY_CODE_SEGMENT_INVALID');
  });
});
