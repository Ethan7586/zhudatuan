import type { RiskActionProposal } from './RiskAction';
import type { RiskOutcome } from './RiskPolicy';

export type RiskReason = 'policy' | 'amount' | 'velocity' | 'signal' | 'list' | 'timeout' | 'dependency';

export interface SignalEvidence {
  readonly type: string;
  readonly version: number;
  readonly source: string;
  readonly sensitivity: 'public' | 'personal' | 'sensitive';
  readonly observedAt: string;
  readonly contribution: number;
  /** Sensitive values are deliberately omitted from durable decision evidence. */
  readonly value?: number;
}

export interface DecisionEvidence {
  readonly policy: Readonly<{ id: string; version: number; hash: string }>;
  readonly reason: RiskReason;
  readonly matchedRules: readonly string[];
  readonly signals: readonly SignalEvidence[];
  readonly context: Readonly<{ amountMinor: number | null; velocity: number; blocked: boolean }>;
}

export interface RiskDecisionDraft {
  readonly policy: Readonly<{ id: string; version: number; hash: string }>;
  readonly outcome: RiskOutcome;
  readonly score: number;
  readonly safeReason: RiskReason;
  readonly evidence: DecisionEvidence;
  readonly action: RiskActionProposal | null;
}

export interface Decision extends RiskDecisionDraft {
  readonly id: string;
  readonly scope: string;
}

export const OUTCOME_SEVERITY: Readonly<Record<RiskOutcome, number>> = Object.freeze({ allow: 0, challenge: 1, review: 2, deny: 3 });
