import type { ExperienceDocument } from '@shop/contract';
import { createHash } from 'node:crypto';
import { serializeExperience } from '@shop/contract';
import { DomainError } from '../../../../platform/error/DomainError';
import type { ComponentIssue } from '../value/ComponentTree';
import type { PublishEvidence, PublishEvidenceSnapshot } from '../value/PublishEvidence';

export type ValidationState = 'pending' | 'valid' | 'invalid';
export interface ExperienceVersionSnapshot {
  readonly id: string;
  readonly application: string;
  readonly sequence: number;
  readonly document: ExperienceDocument;
  readonly hash: string;
  readonly validation: ValidationState;
  readonly issues: readonly ComponentIssue[];
  readonly evidence: PublishEvidenceSnapshot | null;
  readonly reason: string;
  readonly source: string | null;
  readonly actor: string;
  readonly createdAt: string;
  readonly frozenAt: string | null;
}

export class ExperienceVersion {
  private constructor(private readonly value: ExperienceVersionSnapshot) {
    validate(value);
    Object.freeze(this);
  }

  static create(input: Omit<ExperienceVersionSnapshot, 'hash' | 'validation' | 'issues' | 'evidence' | 'frozenAt'>): ExperienceVersion {
    return new ExperienceVersion(freeze({ ...input, hash: hash(input.document), validation: 'pending', issues: [], evidence: null, frozenAt: null }));
  }

  static restore(value: ExperienceVersionSnapshot): ExperienceVersion {
    return new ExperienceVersion(freeze(value));
  }

  validate(evidence: PublishEvidence): ExperienceVersion {
    if (this.value.frozenAt !== null) return this;
    const snapshot = evidence.snapshot();
    return new ExperienceVersion(freeze({ ...this.value, validation: snapshot.issues.length === 0 ? 'valid' : 'invalid', issues: snapshot.issues, evidence: snapshot }));
  }

  freeze(at: string): ExperienceVersion {
    if (this.value.validation !== 'valid' || this.value.issues.length > 0 || this.value.evidence === null || Object.values(this.value.evidence.dependencies).some((dependency) => !dependency.ready)) {
      throw new DomainError('EXPERIENCE_PUBLICATION_INVALID', { issues: this.value.issues });
    }
    return new ExperienceVersion(freeze({ ...this.value, frozenAt: this.value.frozenAt ?? iso(at) }));
  }

  snapshot(): ExperienceVersionSnapshot {
    return this.value;
  }
}

function validate(value: ExperienceVersionSnapshot): void {
  if (!/^version:/.test(value.id) && !/:version:/.test(value.id)) invalid('versionId');
  if (!/^application:/.test(value.application) || value.document.application !== value.application) invalid('application');
  if (!Number.isSafeInteger(value.sequence) || value.sequence < 1 || !/^[0-9a-f]{64}$/.test(value.hash) || value.hash !== hash(value.document)) invalid('version');
  if (value.reason.trim().length < 1 || value.reason.length > 500 || !value.actor) invalid('reason');
  if ((value.validation === 'valid') !== (value.issues.length === 0) && value.validation !== 'pending') invalid('validation');
  if (value.validation === 'pending' ? value.evidence !== null || value.issues.length > 0 : value.evidence === null) invalid('evidence');
  if (value.evidence !== null && (value.evidence.issues.length !== value.issues.length || value.evidence.issues.some((issue, index) => issue.code !== value.issues[index]?.code || issue.path !== value.issues[index]?.path)))
    invalid('evidence');
  if (value.frozenAt !== null && (value.validation !== 'valid' || value.evidence === null)) invalid('frozenAt');
}
function hash(value: ExperienceDocument): string {
  return createHash('sha256').update(serializeExperience(value)).digest('hex');
}
function freeze(value: ExperienceVersionSnapshot): ExperienceVersionSnapshot {
  const evidence =
    value.evidence === null
      ? null
      : Object.freeze({
          dependencies: Object.freeze(Object.fromEntries(Object.entries(value.evidence.dependencies).map(([name, dependency]) => [name, Object.freeze({ ...dependency })])) as PublishEvidenceSnapshot['dependencies']),
          issues: Object.freeze(value.evidence.issues.map((issue) => Object.freeze({ ...issue }))),
        });
  return Object.freeze({
    ...value,
    document: value.document,
    issues: Object.freeze(value.issues.map((issue) => Object.freeze({ ...issue }))),
    evidence,
    createdAt: iso(value.createdAt),
    frozenAt: value.frozenAt === null ? null : iso(value.frozenAt),
  });
}
function iso(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) invalid('time');
  return parsed.toISOString();
}
function invalid(field: string): never {
  throw new DomainError('VALIDATION_FAILED', { field });
}
