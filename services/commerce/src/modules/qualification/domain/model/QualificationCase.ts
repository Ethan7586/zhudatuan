import { DomainError } from '../../../../foundation/domain/DomainError';
import { Evidence, type EvidenceSnapshot } from './Evidence';

export type QualificationTargetKind = 'partner' | 'product' | 'category' | 'region';
export type QualificationState = 'draft' | 'verified' | 'published' | 'revoked' | 'expired';

export interface QualificationTarget {
  readonly kind: QualificationTargetKind;
  readonly id: string;
}

export interface QualificationCaseSnapshot {
  readonly id: string;
  readonly scope: string;
  readonly title: string;
  readonly subject: QualificationTarget;
  readonly applicability: readonly QualificationTarget[];
  readonly state: QualificationState;
  readonly version: number;
  readonly effectiveAt: string;
  readonly expiresAt: string;
  readonly evidence: readonly EvidenceSnapshot[];
  readonly reviewedAt: string | null;
  readonly reviewedBy: string | null;
  readonly publishedAt: string | null;
  readonly revokedAt: string | null;
  readonly revokedBy: string | null;
  readonly revokeReason: string | null;
}

export class QualificationCase {
  private constructor(private readonly value: QualificationCaseSnapshot) {
    validate(value);
    Object.freeze(this);
  }

  static restore(snapshot: QualificationCaseSnapshot): QualificationCase {
    return new QualificationCase(freeze(snapshot));
  }

  static verified(input: Readonly<Omit<QualificationCaseSnapshot, 'state' | 'version' | 'reviewedAt' | 'reviewedBy' | 'publishedAt' | 'revokedAt' | 'revokedBy' | 'revokeReason'>> & Readonly<{ actor: string; now: string }>): QualificationCase {
    return new QualificationCase(
      freeze({
        id: input.id,
        scope: input.scope,
        title: input.title,
        subject: input.subject,
        applicability: input.applicability,
        effectiveAt: input.effectiveAt,
        expiresAt: input.expiresAt,
        evidence: input.evidence,
        state: 'verified',
        version: 0,
        reviewedAt: input.now,
        reviewedBy: input.actor,
        publishedAt: null,
        revokedAt: null,
        revokedBy: null,
        revokeReason: null,
      })
    );
  }

  publish(now: string): QualificationCase {
    if (this.value.state !== 'verified') invalid('state', 'QUALIFICATION_NOT_VERIFIED');
    if (Date.parse(this.value.effectiveAt) > Date.parse(this.value.expiresAt) || Date.parse(this.value.expiresAt) <= Date.parse(now)) invalid('expiresAt', 'QUALIFICATION_EXPIRED');
    this.value.evidence.forEach((item) => new Evidence(item).assertVerified());
    if (this.value.evidence.length === 0) invalid('evidence', 'EVIDENCE_REQUIRED');
    return new QualificationCase(freeze({ ...this.value, state: 'published', version: this.value.version + 1, publishedAt: now }));
  }

  revoke(actor: string, reason: string, now: string): QualificationCase {
    if (this.value.state !== 'published') invalid('state', 'QUALIFICATION_NOT_PUBLISHED');
    const normalized = reason.trim();
    if (normalized.length < 2 || normalized.length > 500) invalid('reason');
    return new QualificationCase(freeze({ ...this.value, state: 'revoked', version: this.value.version + 1, revokedAt: now, revokedBy: actor, revokeReason: normalized }));
  }

  expire(now: string): QualificationCase | null {
    if (this.value.state !== 'published' || Date.parse(this.value.expiresAt) > Date.parse(now)) return null;
    return new QualificationCase(freeze({ ...this.value, state: 'expired', version: this.value.version + 1 }));
  }

  snapshot(): QualificationCaseSnapshot {
    return this.value;
  }
}

function validate(value: QualificationCaseSnapshot): void {
  if (!/^qualification:[A-Za-z0-9][A-Za-z0-9.:/-]{0,241}$/.test(value.id)) invalid('qualificationId');
  if (!value.scope || value.scope.length > 255) invalid('scope');
  if (value.title.trim().length < 1 || value.title.trim().length > 255) invalid('title');
  target(value.subject, 'subject');
  if (value.applicability.length === 0 || value.applicability.length > 100) invalid('applicability');
  const keys = value.applicability.map((item) => `${item.kind}:${item.id}`);
  value.applicability.forEach((item) => target(item, 'applicability'));
  if (new Set(keys).size !== keys.length) invalid('applicability');
  if (!['draft', 'verified', 'published', 'revoked', 'expired'].includes(value.state)) invalid('state');
  if (!Number.isSafeInteger(value.version) || value.version < 0) invalid('version');
  if (Number.isNaN(Date.parse(value.effectiveAt)) || Number.isNaN(Date.parse(value.expiresAt)) || Date.parse(value.expiresAt) <= Date.parse(value.effectiveAt)) invalid('expiresAt');
  if (value.evidence.length === 0 || value.evidence.length > 20) invalid('evidence');
  const evidence = value.evidence.map((item) => new Evidence(item));
  if (new Set(evidence.map((item) => item.id)).size !== evidence.length) invalid('evidence');
  if ((value.state === 'verified' || value.state === 'published' || value.state === 'revoked' || value.state === 'expired') && (!value.reviewedAt || !value.reviewedBy)) invalid('reviewState');
  if (value.state === 'published' && !value.publishedAt) invalid('publishedAt');
  if (value.state === 'revoked' && (!value.revokedAt || !value.revokedBy || !value.revokeReason)) invalid('revokeReason');
}

function target(value: QualificationTarget, field: string): void {
  if (!['partner', 'product', 'category', 'region'].includes(value.kind) || !/^[a-z][a-z0-9]*:[A-Za-z0-9][A-Za-z0-9.:/-]*$/.test(value.id)) invalid(field);
}

function freeze(value: QualificationCaseSnapshot): QualificationCaseSnapshot {
  return Object.freeze({
    ...value,
    subject: Object.freeze({ ...value.subject }),
    applicability: Object.freeze(value.applicability.map((item) => Object.freeze({ ...item }))),
    evidence: Object.freeze(value.evidence.map((item) => Object.freeze({ ...item }))),
  });
}

function invalid(field: string, reason?: string): never {
  throw new DomainError('VALIDATION_FAILED', { field, ...(reason ? { reason } : {}) });
}
