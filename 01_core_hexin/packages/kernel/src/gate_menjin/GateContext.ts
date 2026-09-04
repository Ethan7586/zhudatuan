export interface GateContext {
  readonly operation_id: string;
  readonly execution_phase: string;
  readonly trace_id: string;
  readonly attributes?: Readonly<Record<string, unknown>>;
}
