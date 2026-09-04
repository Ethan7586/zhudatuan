import type { AccessContext, Actor } from './AccessContext';
import { token } from '../../bootstrap/Container';
import { DomainError } from '../domain/DomainError';

export type RiskOutcome = 'allow' | 'challenge' | 'review' | 'deny';
export interface RiskAssessment {
  readonly outcome: RiskOutcome;
  readonly safeReason: 'policy' | 'amount' | 'velocity' | 'signal' | 'list' | 'timeout' | 'dependency';
  readonly decision: string | null;
}

export interface RiskGate {
  evaluate(
    input: Readonly<{ actor: Actor; operation: string; resource?: string; scope: AccessContext['scope']; trace: string; deadline: number; signal: AbortSignal; amountMinor?: number; signals?: Readonly<Record<string, number>> }>
  ): Promise<RiskAssessment>;
}

export const RISK_GATE = token<RiskGate>('risk.gate');

export function assertRiskAllowed(outcome: RiskOutcome): void {
  if (outcome !== 'allow') throw new DomainError(outcome === 'challenge' ? 'STEPUP_REQUIRED' : 'AUTHORIZATION_DENIED', { reason: outcome === 'review' ? 'RISK_REVIEW_REQUIRED' : 'RISK_DENIED' });
}
