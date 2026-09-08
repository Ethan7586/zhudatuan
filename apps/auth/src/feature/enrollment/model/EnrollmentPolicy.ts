import type { OperationOutputFor } from '@shop/contract';

export function canEditDisplayName(subjectMode: OperationOutputFor<'identity.enrollments.read'>['subjectMode']): boolean {
  return subjectMode === 'input';
}
