import type { ReconciliationProcess } from '../port/ReconciliationProcess';
import type { ReconciliationReviewPort } from '../port/ReconciliationReviewPort';
import { ReconciliationPolicy } from '../../domain/policy/ReconciliationPolicy';

export class ReconcileFinance {
  constructor(
    private readonly process: ReconciliationProcess,
    private readonly reviews: ReconciliationReviewPort,
    private readonly policy = new ReconciliationPolicy()
  ) {}

  post(event: Readonly<Record<string, unknown>>, signal: AbortSignal, deadline: number): Promise<void> {
    return this.process.post(event, signal, deadline);
  }

  async execute(reconciliation: string, scope: string, signal: AbortSignal, deadline: number): Promise<void> {
    const outcome = await this.process.reconcile(reconciliation, scope, signal, deadline);
    await this.reviews.route(outcome, this.policy.route(outcome), signal, deadline);
  }
}
