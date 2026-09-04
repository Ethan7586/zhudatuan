import type { GateContext } from './GateContext';
import type { GateDecision } from './GateDecision';

export interface GatePlugin {
  readonly gate_id: string;
  readonly gate_slot: string;
  readonly policy_version: string;
  evaluate(context: GateContext): Promise<GateDecision>;
}
