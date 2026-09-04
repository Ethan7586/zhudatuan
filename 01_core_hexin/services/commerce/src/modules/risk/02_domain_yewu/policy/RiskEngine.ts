import { OUTCOME_SEVERITY } from '../model/Decision';
import type { Signal } from '../model/Signal';
import type { RiskOutcome, RiskRule } from '../model/RiskPolicy';

export interface RiskEvaluation {
  readonly actor: string;
  readonly operation: string;
  readonly amountMinor: number | null;
  readonly velocity: number;
  readonly blocked: boolean;
  readonly signals: readonly Signal[];
}

export interface RiskResult { readonly outcome: RiskOutcome; readonly score: number; readonly reason: 'policy' | 'amount' | 'velocity' | 'signal' | 'list' }

export class RiskEngine {
  evaluate(rule: RiskRule, input: RiskEvaluation): RiskResult {
    if (input.blocked || rule.blockedActors.includes(input.actor)) return Object.freeze({ outcome: 'deny', score: 0, reason: 'list' });
    if (rule.denyOperations.includes(input.operation)) return Object.freeze({ outcome: 'deny', score: 0, reason: 'policy' });
    if (rule.maximumAmountMinor !== null && input.amountMinor !== null && input.amountMinor > rule.maximumAmountMinor) {
      return Object.freeze({ outcome: 'deny', score: 0, reason: 'amount' });
    }
    let outcome: RiskOutcome = rule.reviewOperations.includes(input.operation) ? 'review'
      : rule.challengeOperations.includes(input.operation) ? 'challenge' : 'allow';
    let reason: RiskResult['reason'] = 'policy';
    if (rule.reviewAmountMinor !== null && input.amountMinor !== null && input.amountMinor > rule.reviewAmountMinor) {
      outcome = higher(outcome, 'review'); reason = 'amount';
    }
    if (rule.velocity && input.velocity > rule.velocity.maximum) { outcome = higher(outcome, rule.velocity.outcome); reason = 'velocity'; }
    const values = new Map(input.signals.map((item) => [item.type, item.value]));
    const score = rule.scores.reduce((total, item) => total+(Number(values.get(item.signal) ?? 0) >= item.minimum ? item.points : 0), 0);
    const scored: RiskOutcome = score >= rule.thresholds.deny ? 'deny' : score >= rule.thresholds.review ? 'review'
      : score >= rule.thresholds.challenge ? 'challenge' : 'allow';
    if (OUTCOME_SEVERITY[scored] > OUTCOME_SEVERITY[outcome]) { outcome = scored; reason = 'signal'; }
    return Object.freeze({ outcome, score, reason });
  }
}

function higher(left: RiskOutcome, right: RiskOutcome): RiskOutcome { return OUTCOME_SEVERITY[left] >= OUTCOME_SEVERITY[right] ? left : right; }
