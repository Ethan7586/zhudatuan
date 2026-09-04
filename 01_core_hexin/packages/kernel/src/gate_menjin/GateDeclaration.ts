export type GateMode = 'disabled' | 'observe';

export interface GateDeclaration {
  readonly operation_id: string;
  readonly gate_slots: readonly string[];
  readonly execution_phase: string;
  readonly mode: GateMode;
  readonly failure_behavior: string;
}
