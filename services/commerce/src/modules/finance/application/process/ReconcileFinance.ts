import type { ReconciliationProcess } from '../port/ReconciliationProcess';

export class ReconcileFinance {
  constructor(private readonly process: ReconciliationProcess) {}

  post(event: Readonly<Record<string, unknown>>, signal: AbortSignal, deadline: number): Promise<void> {
    return this.process.post(event, signal, deadline);
  }

  execute(reconciliation: string, scope: string, signal: AbortSignal, deadline: number): Promise<void> {
    return this.process.reconcile(reconciliation, scope, signal, deadline);
  }
}
