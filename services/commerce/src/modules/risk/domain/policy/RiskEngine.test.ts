import { describe, expect, it } from 'vitest';
import { RiskCase } from '../model/RiskCase';
import { RiskPolicy } from '../model/RiskPolicy';
import { signal } from '../model/Signal';
import { RiskEngine } from './RiskEngine';

const evaluate = (rule: unknown, input: Partial<Parameters<RiskEngine['evaluate']>[1]> = {}) => {
  const policy = new RiskPolicy('policy', 7, rule, 100);
  return new RiskEngine().evaluate(policy.rule, { actor: 'actor', operation: 'payment.intents.create', amountMinor: null,
    velocity: 0, blocked: false, signals: [], ...input });
};

describe('RiskEngine', () => {
  it('applies hard deterministic limits before scoring and never lowers their outcome', () => {
    expect(evaluate({ maximumAmountMinor: 100, scores: [{ signal: 'trust.score', minimum: 1, points: 1 }],
      thresholds: { challenge: 1, review: 2, deny: 3 } }, { amountMinor: 101, signals: [signal('trust.score', 0, '2026-08-21T00:00:00Z')] }))
      .toMatchObject({ outcome: 'deny', reason: 'amount' });
    expect(evaluate({ reviewOperations: ['payment.intents.create'], scores: [], thresholds: { challenge: 1, review: 2, deny: 3 } }).outcome)
      .toBe('review');
  });

  it('uses stable actor bucketing and rejects unknown policy fields', () => {
    const policy = new RiskPolicy('policy', 7, {}, 37);
    expect(policy.selected('actor')).toBe(policy.selected('actor'));
    expect(() => new RiskPolicy('policy', 7, { typoThreshold: 1 }, 100)).toThrow('RISK_POLICY_FIELD_UNKNOWN');
  });

  it('requires an independent reviewer and legal case transitions', () => {
    const opened = new RiskCase('case', 'open', 'actor');
    expect(() => opened.review('clear', 'actor')).toThrow('RISK_CASE_REVIEWER_SEPARATION_REQUIRED');
    expect(opened.review('accept', 'reviewer')).toBe('reviewing');
    expect(() => opened.review('close', 'reviewer')).toThrow('RISK_CASE_TRANSITION_INVALID');
    expect(new RiskCase('case', 'cleared', 'actor').review('close', 'reviewer')).toBe('closed');
  });
});
