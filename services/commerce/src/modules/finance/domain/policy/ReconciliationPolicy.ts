import { DomainError } from '../../../../foundation/domain/DomainError';
import type { ReconciliationOutcome } from '../model/ReconciliationOutcome';

export type ReconciliationReviewRoute = 'none' | 'automatic' | 'approval';

/** Owns the sole threshold decision; adapters may persist the decision but cannot reinterpret it. */
export class ReconciliationPolicy {
  threshold(rule: unknown): number {
    if (rule === null || typeof rule !== 'object' || Array.isArray(rule)) return 0;
    const amount = Reflect.get(rule, 'amountMinor');
    if (!Number.isSafeInteger(amount) || (amount as number) < 0) throw new DomainError('VALIDATION_FAILED', { field: 'rule.amountMinor' });
    return amount as number;
  }

  route(outcome: ReconciliationOutcome): ReconciliationReviewRoute {
    if (outcome.state === 'balanced') return 'none';
    if (
      !Number.isSafeInteger(outcome.thresholdMinor) ||
      outcome.thresholdMinor < 0 ||
      !Number.isSafeInteger(outcome.maximumDifferenceMinor) ||
      outcome.maximumDifferenceMinor < 0 ||
      outcome.differenceCount < 1
    ) {
      throw new DomainError('VALIDATION_FAILED', { field: 'reconciliationThreshold' });
    }
    return Math.abs(outcome.differenceMinor) <= outcome.thresholdMinor && outcome.maximumDifferenceMinor <= outcome.thresholdMinor
      ? 'automatic'
      : 'approval';
  }
}
