import type { ReconciliationOutcome } from './ReconciliationProcess';
import type { ReconciliationReviewRoute } from '../../domain/policy/ReconciliationPolicy';

export interface ReconciliationReviewPort {
  route(outcome: ReconciliationOutcome, route: ReconciliationReviewRoute, signal: AbortSignal, deadline: number): Promise<void>;
}
