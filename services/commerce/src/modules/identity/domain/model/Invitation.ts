import { DomainError } from '../../../../foundation/domain/DomainError';
export type InvitationKind = 'signin' | 'enrollment' | 'campaign';
export type InvitationTarget = 'console' | 'storefront';
export type InvitationStatus = 'draft' | 'active' | 'exhausted' | 'revoked' | 'expired';

export interface InvitationState {
  readonly id: string;
  readonly kind: InvitationKind;
  readonly target: InvitationTarget;
  readonly organization: string;
  readonly membership: string | null;
  readonly principal: string | null;
  readonly recipientHash: Buffer | null;
  readonly keyVersion: string;
  readonly issuer: string;
  readonly issuerAccessVersion: number;
  readonly grantDigest: string;
  readonly assurance: 1 | 2 | 3;
  readonly maxUses: number;
  readonly useCount: number;
  readonly notBefore: Date;
  readonly expiresAt: Date;
  readonly status: InvitationStatus;
  readonly policy: string | null;
  readonly termsHash: string | null;
  readonly reason: string;
  readonly version: number;
}

export class Invitation {
  constructor(readonly state: InvitationState) {
    Invitation.assert(state);
    Object.freeze(this);
  }

  activate(now: Date): Invitation {
    if (this.state.status !== 'draft' || this.state.notBefore > now || this.state.expiresAt <= now) throw new DomainError('INVITATION_INVALID');
    return this.with({ status: 'active' });
  }

  assertResolvable(now: Date, target: InvitationTarget): void {
    this.assertRedeemable(now, target);
  }

  reserve(now: Date, reservedUses: number): Invitation {
    this.assertRedeemable(now, this.state.target);
    if (!Number.isSafeInteger(reservedUses) || reservedUses < 0 || this.state.useCount + reservedUses >= this.state.maxUses) {
      throw new DomainError('INVITATION_INVALID');
    }
    return this;
  }

  assertRedeemable(now: Date, target: InvitationTarget): void {
    if (this.deriveValidity(now) !== 'active' || this.state.target !== target) throw new DomainError('INVITATION_INVALID');
  }

  consume(now: Date): Invitation {
    this.assertRedeemable(now, this.state.target);
    const uses = this.state.useCount + 1;
    return this.with({ useCount: uses, status: uses >= this.state.maxUses ? 'exhausted' : 'active', version: this.state.version + 1 });
  }

  revoke(): Invitation {
    if (this.state.status !== 'active' && this.state.status !== 'draft') throw new DomainError('INVITATION_STALE');
    return this.with({ status: 'revoked', version: this.state.version + 1 });
  }

  expire(now: Date): Invitation {
    if (this.state.status !== 'active' || this.state.expiresAt > now) return this;
    return this.with({ status: 'expired', version: this.state.version + 1 });
  }

  deriveValidity(now: Date): InvitationStatus {
    if (this.state.status === 'active' && this.state.expiresAt <= now) return 'expired';
    if (this.state.status === 'active' && this.state.useCount >= this.state.maxUses) return 'exhausted';
    return this.state.status;
  }

  requiresProof(): boolean {
    return this.state.target === 'console';
  }
  requiresEnrollment(): boolean {
    return this.state.kind !== 'signin';
  }

  private with(change: Partial<InvitationState>): Invitation {
    return new Invitation(Object.freeze({ ...this.state, ...change }));
  }

  private static assert(state: InvitationState): void {
    if (
      !Number.isSafeInteger(state.version) ||
      state.version < 1 ||
      !Number.isSafeInteger(state.maxUses) ||
      state.maxUses < 1 ||
      !Number.isSafeInteger(state.useCount) ||
      state.useCount < 0 ||
      state.useCount > state.maxUses ||
      state.expiresAt <= state.notBefore
    )
      throw new Error('INVITATION_STATE_INVALID');
    if (state.status === 'exhausted' && state.useCount !== state.maxUses) throw new Error('INVITATION_STATE_INVALID');
    if (state.kind === 'signin' && (!state.membership || !state.principal || state.maxUses !== 1)) throw new Error('INVITATION_STATE_INVALID');
    if (state.kind === 'enrollment' && (!state.membership || state.principal || !state.recipientHash || state.maxUses !== 1 || state.target !== 'storefront')) throw new Error('INVITATION_STATE_INVALID');
    if (state.kind === 'campaign' && (state.membership || state.principal || state.target !== 'storefront')) throw new Error('INVITATION_STATE_INVALID');
    if (state.target === 'console' && (!state.recipientHash || state.kind !== 'signin' || state.assurance < 2)) throw new Error('INVITATION_STATE_INVALID');
  }
}
