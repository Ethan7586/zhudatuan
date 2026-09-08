import { DomainError } from '../../../../platform/error/DomainError';
import type { ApprovalOutcome } from '../value/ApprovalDecision';

export class ApprovalTask {
  readonly id: string;
  readonly state: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired' | 'escalated';
  readonly requester: string;
  readonly dueAt: Date | null;
  readonly minimumApprovals: number;
  readonly approvalCount: number;
  readonly version: number;

  constructor(
    value: Readonly<{
      id: string;
      state: ApprovalTask['state'];
      requester: string;
      dueAt: Date | null;
      minimumApprovals: number;
      approvalCount: number;
      version: number;
    }>
  ) {
    if (
      !value.id ||
      !value.requester ||
      !Number.isSafeInteger(value.minimumApprovals) ||
      value.minimumApprovals < 1 ||
      !Number.isSafeInteger(value.approvalCount) ||
      value.approvalCount < 0 ||
      value.approvalCount > value.minimumApprovals ||
      !Number.isSafeInteger(value.version) ||
      value.version < 0
    ) {
      throw new DomainError('VALIDATION_FAILED');
    }
    this.id = value.id;
    this.state = value.state;
    this.requester = value.requester;
    this.dueAt = value.dueAt;
    this.minimumApprovals = value.minimumApprovals;
    this.approvalCount = value.approvalCount;
    this.version = value.version;
    Object.freeze(this);
  }

  decide(outcome: ApprovalOutcome, expectedVersion: number, now: Date): 'pending' | 'approved' | 'rejected' {
    if (this.version !== expectedVersion) throw new DomainError('APPROVAL_TASK_CONFLICT');
    if (this.state !== 'pending' && this.state !== 'escalated') throw new DomainError('APPROVAL_ALREADY_DECIDED');
    if (this.dueAt !== null && this.dueAt.getTime() <= now.getTime()) throw new DomainError('APPROVAL_INSTANCE_EXPIRED');
    if (outcome === 'rejected') return 'rejected';
    return this.approvalCount + 1 >= this.minimumApprovals ? 'approved' : 'pending';
  }
}
