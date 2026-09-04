import { DomainError } from '../../../../foundation/domain/DomainError';

export class EscalationPolicy {
  next(now: Date, dueAt: Date | null, action: 'notify' | 'reassign' | 'reject'): 'waiting' | 'notify' | 'reassign' | 'reject' {
    if (Number.isNaN(now.getTime()) || (dueAt !== null && Number.isNaN(dueAt.getTime()))) throw new DomainError('VALIDATION_FAILED');
    if (dueAt === null || dueAt.getTime() > now.getTime()) return 'waiting';
    return action;
  }
}
