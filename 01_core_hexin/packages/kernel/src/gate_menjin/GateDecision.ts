export type GateDecisionKind = 'allow' | 'deny' | 'not_applicable' | 'error';

export interface GateDecision {
  readonly decision: GateDecisionKind;
  readonly gate_id: string;
  readonly policy_version: string;
  readonly reason_code: string;
  readonly trace_id: string;
  readonly duration_ms: number;
}
