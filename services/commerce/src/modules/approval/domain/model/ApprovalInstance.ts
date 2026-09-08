import { DomainError } from '../../../../platform/error/DomainError';

export class ApprovalInstance {
  readonly id: string;
  readonly state: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';
  readonly requester: string;
  readonly currentStep: number;
  readonly stepCount: number;
  readonly expiresAt: Date | null;
  readonly version: number;

  constructor(value: Readonly<{ id: string; state: ApprovalInstance['state']; requester: string; currentStep: number; stepCount: number; expiresAt: Date | null; version: number }>) {
    if (!value.id || !value.requester || !Number.isSafeInteger(value.currentStep) || value.currentStep < 1 || value.stepCount < value.currentStep || !Number.isSafeInteger(value.version) || value.version < 0) {
      throw new DomainError('VALIDATION_FAILED');
    }
    this.id = value.id;
    this.state = value.state;
    this.requester = value.requester;
    this.currentStep = value.currentStep;
    this.stepCount = value.stepCount;
    this.expiresAt = value.expiresAt;
    this.version = value.version;
    Object.freeze(this);
  }

  decide(outcome: 'approved' | 'rejected', now: Date, stepSatisfied = true): Readonly<{ state: ApprovalInstance['state']; nextStep: number | null }> {
    if (this.state !== 'pending') throw new DomainError('APPROVAL_ALREADY_DECIDED');
    if (this.expiresAt !== null && this.expiresAt.getTime() <= now.getTime()) throw new DomainError('APPROVAL_INSTANCE_EXPIRED');
    if (outcome === 'rejected') return Object.freeze({ state: 'rejected', nextStep: null });
    if (!stepSatisfied) return Object.freeze({ state: 'pending', nextStep: this.currentStep });
    if (this.currentStep >= this.stepCount) return Object.freeze({ state: 'approved', nextStep: null });
    return Object.freeze({ state: 'pending', nextStep: this.currentStep + 1 });
  }
}
