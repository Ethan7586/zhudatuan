import { createHash } from 'node:crypto';

export type IdentityCodeKind = 'operator' | 'member';
export type IdentityCode = `OP-${string}`;

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function identityCodeCandidate(
  contextId: string,
  kind: 'operator',
  membershipId: string,
  attempt = 0,
): IdentityCode {
  const length = 4;
  const digest = createHash('sha256').update(`${contextId}\0${kind}\0${membershipId}\0${attempt}`).digest();
  let value = digest.readBigUInt64BE();
  let suffix = '';
  for (let index = 0; index < length; index += 1) {
    suffix = ALPHABET[Number(value % BigInt(ALPHABET.length))]! + suffix;
    value /= BigInt(ALPHABET.length);
  }
  return `OP-${suffix}`;
}

export function allocateIdentityCodes(
  membershipIds: readonly string[],
  existing: ReadonlyMap<string, IdentityCode>,
  occupied: ReadonlySet<IdentityCode>,
  candidate: (membershipId: string, attempt: number) => IdentityCode,
): ReadonlyMap<string, IdentityCode> {
  const assigned = new Map(existing);
  const used = new Set(occupied);
  for (const membershipId of [...new Set(membershipIds)].sort()) {
    const current = assigned.get(membershipId);
    if (current !== undefined) {
      used.add(current);
      continue;
    }
    let code: IdentityCode | undefined;
    for (let attempt = 0; attempt < 64 && code === undefined; attempt += 1) {
      const next = candidate(membershipId, attempt);
      if (!used.has(next)) code = next;
    }
    if (code === undefined) throw new Error('IDENTITY_DISPLAY_CODE_SPACE_EXHAUSTED');
    assigned.set(membershipId, code);
    used.add(code);
  }
  return assigned;
}
