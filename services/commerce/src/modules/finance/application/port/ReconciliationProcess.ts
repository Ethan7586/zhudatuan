import type { ReconciliationOutcome } from '../../domain/model/ReconciliationOutcome';
export type { ReconciliationOutcome } from '../../domain/model/ReconciliationOutcome';

export interface ReconciliationProcess {
  post(event: Readonly<Record<string, unknown>>, signal: AbortSignal, deadline: number): Promise<void>;
  reconcile(reconciliation: string, scope: string, signal: AbortSignal, deadline: number): Promise<ReconciliationOutcome>;
}
