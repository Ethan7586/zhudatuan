import { createHash } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTUVWXYZ';
const SEGMENT_LENGTH = 4;
const CAPACITY = ALPHABET.length ** SEGMENT_LENGTH;
const SEGMENT_PATTERN = /^[0-9A-HJKMNP-Z]{4}$/;

export type MemberIdentityCode = `MB-${string}`;

/** Pure allocator; the global ST registry persists this once and never releases reserved segments. */
export function allocateStorefrontSegment(
  storefrontNodeId: string,
  existing: string | null,
  reserved: ReadonlySet<string>,
): string {
  if (existing !== null) return segment(existing);
  return firstAvailable(`st\0${storefrontNodeId}`, reserved);
}

/** Pure batch allocator; the owning ST persists suffixes by full Membership ID. */
export function allocateMemberSuffixes(
  storefrontNodeId: string,
  membershipIds: readonly string[],
  existing: ReadonlyMap<string, string>,
  reserved: ReadonlySet<string>,
): ReadonlyMap<string, string> {
  const used = new Set([...reserved, ...existing.values()]);
  const assigned = new Map<string, string>();
  for (const membershipId of [...new Set(membershipIds)].sort()) {
    const current = existing.get(membershipId);
    const suffix = current === undefined
      ? firstAvailable(`mb\0${storefrontNodeId}\0${membershipId}`, used)
      : segment(current);
    assigned.set(membershipId, suffix);
    used.add(suffix);
  }
  return assigned;
}

export function formatMemberIdentityCode(prefix: string, suffix: string): MemberIdentityCode {
  return `MB-${segment(prefix)}${segment(suffix)}`;
}

function firstAvailable(seed: string, reserved: ReadonlySet<string>): string {
  const digest = createHash('sha256').update(seed).digest();
  const start = Number(digest.readBigUInt64BE() % BigInt(CAPACITY));
  for (let offset = 0; offset < CAPACITY; offset += 1) {
    const candidate = encode((start + offset) % CAPACITY);
    if (!reserved.has(candidate)) return candidate;
  }
  throw new Error('MB_IDENTITY_CODE_SPACE_EXHAUSTED');
}

function encode(index: number): string {
  let value = index;
  let result = '';
  for (let digit = 0; digit < SEGMENT_LENGTH; digit += 1) {
    result = ALPHABET[value % ALPHABET.length]! + result;
    value = Math.floor(value / ALPHABET.length);
  }
  return result;
}

function segment(value: string): string {
  if (!SEGMENT_PATTERN.test(value)) throw new Error('MB_IDENTITY_CODE_SEGMENT_INVALID');
  return value;
}
