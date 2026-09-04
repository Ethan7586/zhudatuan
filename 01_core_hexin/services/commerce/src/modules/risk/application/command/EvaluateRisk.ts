import { OUTCOME_SEVERITY } from '../../domain/model/Decision';
import { RiskPolicy, type RiskOutcome } from '../../domain/model/RiskPolicy';
import { RiskEngine } from '../../domain/policy/RiskEngine';
import type { RiskAssessment, RiskCheck, RiskCheckInput, RiskRepository } from '../port/RiskCheck';

export class EvaluateRisk implements RiskCheck {
  private readonly engine = new RiskEngine();
  constructor(private readonly repository: RiskRepository) {}

  async check(input: RiskCheckInput): Promise<RiskAssessment> {
    const records = await this.repository.policies(input.scopes);
    if (records.length === 0) return Object.freeze({ outcome: 'allow', safeReason: 'policy', decision: null });
    const [storedSignals, blocked] = await Promise.all([this.repository.signals(input.actor, input.scopes),
      this.repository.blocked(input.actor, input.scopes)]);
    const signals = Object.freeze([...storedSignals, ...input.signals]);
    const policies = records.map((record) => { const candidate = new RiskPolicy(record.id, record.activeVersion, record.activeRule, record.activeRollout);
      return candidate.selected(input.actor) || record.baselineVersion === null || record.baselineRule === null
        ? candidate : new RiskPolicy(record.id, record.baselineVersion, record.baselineRule, 100); });
    const windows = [...new Set(policies.map((policy) => policy.rule.velocity?.windowSeconds ?? 3600))];
    const velocities = await this.repository.velocities(input.actor, input.operation, input.scopes, windows);
    let selected: Readonly<{ policy: RiskPolicy; outcome: RiskOutcome; score: number; reason: RiskAssessment['safeReason']; velocity: number }> | null = null;
    for (const policy of policies) {
      const seconds = policy.rule.velocity?.windowSeconds ?? 3600;
      const velocity = velocities.get(seconds) ?? 0;
      const result = this.engine.evaluate(policy.rule, { actor: input.actor, operation: input.operation, amountMinor: input.amountMinor,
        velocity, blocked, signals });
      if (!selected || OUTCOME_SEVERITY[result.outcome] > OUTCOME_SEVERITY[selected.outcome]) {
        selected = { policy, outcome: result.outcome, score: result.score, reason: result.reason, velocity };
      }
    }
    if (!selected) return Object.freeze({ outcome: 'allow', safeReason: 'policy', decision: null });
    const decision = await this.repository.decision({ check: input, policy: selected.policy.id, version: selected.policy.version, outcome: selected.outcome,
      score: selected.score, safeReason: selected.reason, evidence: { ruleHash: selected.policy.hash, rolloutPercent: selected.policy.rolloutPercent,
        velocity: selected.velocity, signals: signals.map(({ type, value, observedAt }) => ({ type, value, observedAt })),
        amountMinor: input.amountMinor, blocked, scopeChain: input.scopes } });
    return Object.freeze({ outcome: selected.outcome, safeReason: selected.reason, decision });
  }
}
