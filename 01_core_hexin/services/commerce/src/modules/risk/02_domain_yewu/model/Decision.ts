import type { RiskOutcome } from './RiskPolicy';

export interface Decision {
  readonly id: string;
  readonly scope: string;
  readonly policy: string;
  readonly policyVersion: number;
  readonly outcome: RiskOutcome;
  readonly score: number;
  readonly safeReason: 'policy' | 'amount' | 'velocity' | 'signal' | 'list';
  readonly evidence: Readonly<Record<string, unknown>>;
}

export const OUTCOME_SEVERITY: Readonly<Record<RiskOutcome, number>> = Object.freeze({ allow: 0, challenge: 1, review: 2, deny: 3 });
