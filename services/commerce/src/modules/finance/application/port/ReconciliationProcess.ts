export interface ReconciliationProcess {
  post(event: Readonly<Record<string, unknown>>, signal: AbortSignal, deadline: number): Promise<void>;
  reconcile(reconciliation: string, scope: string, signal: AbortSignal, deadline: number): Promise<void>;
}
