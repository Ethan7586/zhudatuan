import { OUTCOME_SEVERITY, type RiskDecisionDraft, type RiskReason, type SignalEvidence } from '../model/Decision';
import type { Signal } from '../model/Signal';
import { RiskPolicy, type RiskOutcome } from '../model/RiskPolicy';
import { ActionPolicy } from './ActionPolicy';

export interface RiskEvaluation {
  readonly actor: string;
  readonly operation: string;
  readonly resource: string | null;
  readonly amountMinor: number | null;
  readonly velocity: number;
  readonly blocked: boolean;
  readonly signals: readonly Signal[];
}

/** Deterministic and side-effect free. The same policy version and facts always produce the same draft. */
export class RiskEngine {
  constructor(private readonly actions = new ActionPolicy()) {}

  evaluate(policy: RiskPolicy, input: RiskEvaluation): RiskDecisionDraft {
    const matched: string[] = [];
    let outcome: RiskOutcome = 'allow';
    let reason: RiskReason = 'policy';
    if (input.blocked || policy.rule.blockedActors.includes(input.actor)) {
      outcome = 'deny';
      reason = 'list';
      matched.push('list.blocked');
    }
    if (policy.rule.denyOperations.includes(input.operation)) {
      if (raises(outcome, 'deny')) reason = 'policy';
      outcome = higher(outcome, 'deny');
      matched.push('operation.deny');
    }
    if (policy.rule.maximumAmountMinor !== null && input.amountMinor !== null && input.amountMinor > policy.rule.maximumAmountMinor) {
      if (raises(outcome, 'deny')) reason = 'amount';
      outcome = higher(outcome, 'deny');
      matched.push('amount.maximum');
    }
    if (policy.rule.reviewOperations.includes(input.operation)) {
      outcome = higher(outcome, 'review');
      matched.push('operation.review');
    } else if (policy.rule.challengeOperations.includes(input.operation)) {
      outcome = higher(outcome, 'challenge');
      matched.push('operation.challenge');
    }
    if (policy.rule.reviewAmountMinor !== null && input.amountMinor !== null && input.amountMinor > policy.rule.reviewAmountMinor) {
      if (raises(outcome, 'review')) reason = 'amount';
      outcome = higher(outcome, 'review');
      matched.push('amount.review');
    }
    if (policy.rule.velocity && input.velocity > policy.rule.velocity.maximum) {
      if (raises(outcome, policy.rule.velocity.outcome)) reason = 'velocity';
      outcome = higher(outcome, policy.rule.velocity.outcome);
      matched.push(`velocity.${policy.rule.velocity.windowSeconds}`);
    }
    const latest = latestSignals(input.signals);
    const signalEvidence: SignalEvidence[] = [];
    let score = 0;
    for (const scoreRule of policy.rule.scores) {
      const observed = latest.get(scoreRule.signal);
      if (!observed) continue;
      const contribution = observed.value >= scoreRule.minimum ? scoreRule.points : 0;
      score += contribution;
      if (contribution > 0) matched.push(`signal.${scoreRule.signal}`);
      signalEvidence.push(
        Object.freeze({
          type: observed.type,
          version: observed.version,
          source: observed.source,
          sensitivity: observed.sensitivity,
          observedAt: observed.observedAt,
          contribution,
          ...(observed.sensitivity === 'sensitive' ? {} : { value: observed.value }),
        })
      );
    }
    const scored: RiskOutcome = score >= policy.rule.thresholds.deny ? 'deny' : score >= policy.rule.thresholds.review ? 'review' : score >= policy.rule.thresholds.challenge ? 'challenge' : 'allow';
    if (OUTCOME_SEVERITY[scored] > OUTCOME_SEVERITY[outcome]) {
      outcome = scored;
      reason = 'signal';
    }
    const evidence = Object.freeze({
      policy: Object.freeze({ id: policy.id, version: policy.version, hash: policy.hash }),
      reason,
      matchedRules: Object.freeze([...new Set(matched)]),
      signals: Object.freeze(signalEvidence),
      context: Object.freeze({ amountMinor: input.amountMinor, velocity: input.velocity, blocked: input.blocked }),
    });
    return Object.freeze({
      policy: evidence.policy,
      outcome,
      score,
      safeReason: reason,
      evidence,
      action: this.actions.propose({ actor: input.actor, operation: input.operation, resource: input.resource, outcome }),
    });
  }
}

function latestSignals(signals: readonly Signal[]): ReadonlyMap<string, Signal> {
  const latest = new Map<string, Signal>();
  for (const item of signals) {
    const current = latest.get(item.type);
    if (!current || current.observedAt < item.observedAt || (current.observedAt === item.observedAt && current.version < item.version)) latest.set(item.type, item);
  }
  return latest;
}

function higher(left: RiskOutcome, right: RiskOutcome): RiskOutcome {
  return OUTCOME_SEVERITY[left] >= OUTCOME_SEVERITY[right] ? left : right;
}

function raises(current: RiskOutcome, candidate: RiskOutcome): boolean {
  return OUTCOME_SEVERITY[candidate] > OUTCOME_SEVERITY[current];
}
