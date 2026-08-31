import { DomainError } from '../../../../foundation/domain/DomainError';

export type InvitationClaimState = 'reserved' | 'proofpending' | 'proved' | 'consumed' | 'revoked' | 'expired';
export class InvitationClaim {
  readonly id: string;
  readonly invitation: string;
  readonly kind: 'signin' | 'enrollment' | 'campaign';
  readonly target: 'console' | 'storefront';
  readonly recipientHash: Buffer | null;
  readonly state: InvitationClaimState;
  readonly proof: 'otp' | 'sso' | 'terms' | null;
  readonly expiresAt: Date;
  readonly provedAt: Date | null;
  readonly version: number;

  constructor(
    value: Readonly<{
      id: string;
      invitation: string;
      kind: 'signin' | 'enrollment' | 'campaign';
      target: 'console' | 'storefront';
      recipientHash: Buffer | null;
      state: InvitationClaimState;
      proof: 'otp' | 'sso' | 'terms' | null;
      expiresAt: Date;
      provedAt: Date | null;
      version: number;
    }>
  ) {
    if (!value.id || !value.invitation || !Number.isSafeInteger(value.version) || value.version < 1 || !Number.isFinite(value.expiresAt.getTime())) throw new DomainError('INVITATION_INVALID');
    this.id = value.id;
    this.invitation = value.invitation;
    this.kind = value.kind;
    this.target = value.target;
    this.recipientHash = value.recipientHash;
    this.state = value.state;
    this.proof = value.proof;
    this.expiresAt = value.expiresAt;
    this.provedAt = value.provedAt;
    this.version = value.version;
    Object.freeze(this);
  }

  assertActive(now: Date): void {
    if (!['reserved', 'proofpending', 'proved'].includes(this.state) || this.expiresAt <= now) throw new DomainError('PREAUTH_EXPIRED');
  }
}
