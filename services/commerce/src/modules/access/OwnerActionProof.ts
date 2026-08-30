import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export type OwnerAction = 'create' | 'accept' | 'cancel';
export type FormerOwnerMode = 'retain_admin' | 'remove_admin';

export interface OwnerActionProofPayload {
  readonly v: 1;
  readonly nonce: string;
  readonly action: OwnerAction;
  readonly actor: string;
  readonly session: string;
  readonly sourceMembership: string;
  readonly targetMembership: string;
  readonly formerOwnerMode: FormerOwnerMode;
  readonly formerOwnerRole: string | null;
  readonly formerOwnerRoleVersion: number | null;
  readonly ownershipVersion: number;
  readonly transferVersion: number | null;
  readonly targetAccessVersion: number;
  readonly reasonHash: string | null;
  readonly expiresAt: string;
}

export interface OwnerActionProofInput extends Omit<OwnerActionProofPayload, 'v' | 'nonce' | 'expiresAt'> {
  readonly ttlMilliseconds?: number;
}

export class OwnerActionProof {
  private readonly key: Buffer;

  constructor(sessionKey: string, private readonly now: () => Date = () => new Date()) {
    if (!sessionKey) throw new Error('OWNER_ACTION_PROOF_KEY_INVALID');
    this.key = createHmac('sha256', sessionKey)
      .update('zhudatuan:owner-action-proof:v1')
      .digest();
  }

  issue(input: OwnerActionProofInput): Readonly<{ proof: string; payload: OwnerActionProofPayload }> {
    const expiresAt = new Date(this.now().getTime() + (input.ttlMilliseconds ?? 5 * 60_000)).toISOString();
    const payload: OwnerActionProofPayload = Object.freeze({
      v: 1,
      nonce: `owner-proof:${randomUUID()}`,
      action: input.action,
      actor: input.actor,
      session: input.session,
      sourceMembership: input.sourceMembership,
      targetMembership: input.targetMembership,
      formerOwnerMode: input.formerOwnerMode,
      formerOwnerRole: input.formerOwnerRole,
      formerOwnerRoleVersion: input.formerOwnerRoleVersion,
      ownershipVersion: input.ownershipVersion,
      transferVersion: input.transferVersion,
      targetAccessVersion: input.targetAccessVersion,
      reasonHash: input.reasonHash,
      expiresAt,
    });
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return Object.freeze({ proof: `${encoded}.${this.signature(encoded)}`, payload });
  }

  verify(proof: string | undefined, expected: Omit<OwnerActionProofPayload, 'v' | 'nonce' | 'expiresAt'>): OwnerActionProofPayload {
    if (!proof) throw new Error('ACTION_PROOF_REQUIRED');
    const [encoded, signature, extra] = proof.split('.');
    if (!encoded || !signature || extra !== undefined || !this.matches(signature, this.signature(encoded))) {
      throw new Error('ACTION_PROOF_INVALID');
    }
    let value: unknown;
    try { value = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')); }
    catch { throw new Error('ACTION_PROOF_INVALID'); }
    if (!isPayload(value) || new Date(value.expiresAt).getTime() <= this.now().getTime()) {
      throw new Error(isPayload(value) ? 'ACTION_PROOF_EXPIRED' : 'ACTION_PROOF_INVALID');
    }
    for (const [key, expectedValue] of Object.entries(expected)) {
      if (value[key as keyof OwnerActionProofPayload] !== expectedValue) throw new Error('ACTION_PROOF_INVALID');
    }
    return Object.freeze(value);
  }

  private signature(value: string): string { return createHmac('sha256', this.key).update(value).digest('base64url'); }

  private matches(left: string, right: string): boolean {
    const actual = Buffer.from(left);
    const expected = Buffer.from(right);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}

function isPayload(value: unknown): value is OwnerActionProofPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return row.v === 1 && typeof row.nonce === 'string' && /^owner-proof:[0-9a-f-]{36}$/.test(row.nonce)
    && ['create', 'accept', 'cancel'].includes(String(row.action))
    && typeof row.actor === 'string' && typeof row.session === 'string'
    && typeof row.sourceMembership === 'string' && typeof row.targetMembership === 'string'
    && ['retain_admin', 'remove_admin'].includes(String(row.formerOwnerMode))
    && (row.formerOwnerRole === null || typeof row.formerOwnerRole === 'string')
    && (row.formerOwnerRoleVersion === null || (Number.isSafeInteger(row.formerOwnerRoleVersion) && Number(row.formerOwnerRoleVersion) >= 0))
    && Number.isSafeInteger(row.ownershipVersion) && Number(row.ownershipVersion) >= 0
    && (row.transferVersion === null || (Number.isSafeInteger(row.transferVersion) && Number(row.transferVersion) >= 0))
    && Number.isSafeInteger(row.targetAccessVersion) && Number(row.targetAccessVersion) > 0
    && (row.reasonHash === null || (typeof row.reasonHash === 'string' && /^[0-9a-f]{64}$/.test(row.reasonHash)))
    && typeof row.expiresAt === 'string' && Number.isFinite(new Date(row.expiresAt).getTime());
}
