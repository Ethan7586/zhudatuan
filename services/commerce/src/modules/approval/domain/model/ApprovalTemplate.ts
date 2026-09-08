import { DomainError } from '../../../../platform/error/DomainError';
import { APPROVAL_SUBJECT_KINDS, type ApprovalSubjectKind } from '../value/ApprovalSubject';

export interface ApprovalStep {
  readonly sequence: number;
  readonly name: string;
  readonly approvers: readonly Readonly<{ kind: 'permission' | 'role' | 'membership'; value: string; minimumApprovals: number }>[];
  readonly dueHours: number;
}

export interface ApprovalEscalation {
  readonly afterHours: number;
  readonly action: 'notify' | 'reassign' | 'reject';
  readonly target?: string;
}

export class ApprovalTemplate {
  readonly code: string;
  readonly name: string;
  readonly subjectKind: ApprovalSubjectKind;
  readonly steps: readonly ApprovalStep[];

  constructor(value: Readonly<{ code: string; name: string; subjectKind: ApprovalSubjectKind; steps: readonly ApprovalStep[] }>) {
    if (!/^[a-z][a-z0-9.]{2,63}$/.test(value.code) || value.name.trim().length < 2 || !APPROVAL_SUBJECT_KINDS.includes(value.subjectKind)) {
      throw new DomainError('VALIDATION_FAILED');
    }
    const sequences = value.steps.map(({ sequence }) => sequence);
    if (value.steps.length === 0 || new Set(sequences).size !== sequences.length || sequences.some((sequence, index) => sequence !== index + 1)) {
      throw new DomainError('VALIDATION_FAILED');
    }
    for (const step of value.steps) {
      if (step.name.trim().length < 2 || !Number.isSafeInteger(step.dueHours) || step.dueHours < 1 || step.approvers.length === 0) throw new DomainError('VALIDATION_FAILED');
      if (new Set(step.approvers.map(({ kind, value: target }) => `${kind}:${target}`)).size !== step.approvers.length) throw new DomainError('VALIDATION_FAILED');
      if (step.approvers.some(({ value: target, minimumApprovals }) => target.trim().length < 2 || !Number.isSafeInteger(minimumApprovals) || minimumApprovals < 1)) {
        throw new DomainError('VALIDATION_FAILED');
      }
    }
    this.code = value.code;
    this.name = value.name.trim();
    this.subjectKind = value.subjectKind;
    this.steps = Object.freeze(value.steps.map((step) => Object.freeze({ ...step, name: step.name.trim(), approvers: Object.freeze(step.approvers.map((approver) => Object.freeze({ ...approver }))) })));
    Object.freeze(this);
  }
}
