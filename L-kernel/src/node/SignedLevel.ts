export type SignedLevel = `L${number}`;
export type SignedLevelSegment = 'supply_side' | 'member_l0_l5' | 'member_l6_l11';

export function classifySignedLevel(signedLevel: SignedLevel | string): SignedLevelSegment {
  const level = signedLevelNumber(signedLevel);
  if (level < 0) return 'supply_side';
  if (level <= 5) return 'member_l0_l5';
  return 'member_l6_l11';
}

export function signedLevelNumber(signedLevel: SignedLevel | string): number {
  if (typeof signedLevel !== 'string') throw new Error('SFL_SIGNED_LEVEL_INVALID');
  const match = /^L(0|[1-9][0-9]*|-[1-9][0-9]*)$/.exec(signedLevel);
  if (match === null) throw new Error('SFL_SIGNED_LEVEL_INVALID');
  const level = Number(match[1]);
  if (!Number.isSafeInteger(level) || level > 11) throw new Error('SFL_SIGNED_LEVEL_INVALID');
  return level;
}
