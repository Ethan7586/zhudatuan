import { DomainError } from '../../../../platform/error/DomainError';

export interface EvidenceObject {
  readonly reference: string;
  readonly sha256: string;
  readonly scan: 'clean';
  readonly retentionUntil: string | null;
}

export type EvidenceKind = 'license' | 'certificate' | 'authorization' | 'agreement' | 'other';
export type EvidenceState = 'submitted' | 'verified' | 'rejected';

export interface EvidenceSnapshot {
  readonly id: string;
  readonly kind: EvidenceKind;
  readonly reference: string;
  readonly sha256: string;
  readonly state: EvidenceState;
  readonly verifiedAt: string | null;
  readonly verifiedBy: string | null;
}

export class Evidence {
  readonly id: string;
  readonly kind: EvidenceKind;
  readonly reference: string;
  readonly sha256: string;
  readonly state: EvidenceState;
  readonly verifiedAt: string | null;
  readonly verifiedBy: string | null;

  constructor(snapshot: EvidenceSnapshot) {
    if (!/^evidence:[A-Za-z0-9][A-Za-z0-9.:/-]{0,246}$/.test(snapshot.id)) invalid('evidenceId');
    if (!['license', 'certificate', 'authorization', 'agreement', 'other'].includes(snapshot.kind)) invalid('evidenceKind');
    if (!/^[a-z0-9][a-z0-9/.:_-]{2,2047}$/i.test(snapshot.reference)) invalid('objectRef');
    if (!/^[a-f0-9]{64}$/.test(snapshot.sha256)) invalid('sha256');
    if (!['submitted', 'verified', 'rejected'].includes(snapshot.state)) invalid('reviewState');
    if ((snapshot.state === 'verified') !== (snapshot.verifiedAt !== null && snapshot.verifiedBy !== null)) invalid('reviewState');
    if (snapshot.verifiedAt !== null && Number.isNaN(Date.parse(snapshot.verifiedAt))) invalid('verifiedAt');
    this.id = snapshot.id;
    this.kind = snapshot.kind;
    this.reference = snapshot.reference;
    this.sha256 = snapshot.sha256;
    this.state = snapshot.state;
    this.verifiedAt = snapshot.verifiedAt;
    this.verifiedBy = snapshot.verifiedBy;
    Object.freeze(this);
  }

  static verified(input: Readonly<{ id: string; kind: EvidenceKind; reference: string; sha256: string; actor: string; now: string }>, metadata: EvidenceObject): Evidence {
    if (metadata.reference !== input.reference || metadata.sha256 !== input.sha256 || metadata.scan !== 'clean' || metadata.retentionUntil === null || Date.parse(metadata.retentionUntil) <= Date.parse(input.now)) {
      throw new DomainError('VALIDATION_FAILED', { field: 'evidence', reason: 'OBJECT_INTEGRITY_MISMATCH' });
    }
    return new Evidence({ ...input, state: 'verified', verifiedAt: input.now, verifiedBy: input.actor });
  }

  assertVerified(): void {
    if (this.state !== 'verified') throw new DomainError('VALIDATION_FAILED', { field: 'evidence', reason: 'EVIDENCE_NOT_VERIFIED' });
  }

  snapshot(): EvidenceSnapshot {
    return Object.freeze({ id: this.id, kind: this.kind, reference: this.reference, sha256: this.sha256, state: this.state, verifiedAt: this.verifiedAt, verifiedBy: this.verifiedBy });
  }
}

function invalid(field: string): never {
  throw new DomainError('VALIDATION_FAILED', { field });
}
