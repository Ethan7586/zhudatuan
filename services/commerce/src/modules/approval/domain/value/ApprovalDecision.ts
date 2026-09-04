import { DomainError } from '../../../../foundation/domain/DomainError';

export type ApprovalOutcome = 'approved' | 'rejected';

export class ApprovalDecision {
  readonly outcome: ApprovalOutcome;
  readonly reason: string;
  readonly evidence: Readonly<Record<string, unknown>>;

  constructor(value: Readonly<{ outcome: ApprovalOutcome; reason: string; evidence?: Readonly<Record<string, unknown>> }>) {
    const reason = value.reason.trim();
    if (!['approved', 'rejected'].includes(value.outcome) || reason.length < 2 || reason.length > 500) throw new DomainError('VALIDATION_FAILED');
    this.outcome = value.outcome;
    this.reason = reason;
    this.evidence = Object.freeze({ ...(value.evidence ?? {}) });
    Object.freeze(this);
  }
}
