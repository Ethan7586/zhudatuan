import { describe, expect, it } from 'vitest';
import { RiskCase } from '../model/RiskCase';
import { RiskPolicy } from '../model/RiskPolicy';
import { signal } from '../model/Signal';
import { RiskEngine } from './RiskEngine';

const evaluate = (rule: unknown, input: Partial<Parameters<RiskEngine['evaluate']>[1]> = {}) => {
  const policy = new RiskPolicy('policy', 7, rule, 100);
  return new RiskEngine().evaluate(policy, { actor: 'actor', operation: 'order.orders.create', resource: 'order:one', amountMinor: null, velocity: 0, blocked: false, signals: [], ...input });
};

const riskSignal = (value: number, sensitivity: 'public' | 'personal' | 'sensitive' = 'personal') => signal({ type: 'trust.score', version: 2, value, source: 'checkout', sensitivity, observedAt: '2026-08-21T00:00:00Z' });

describe('RiskEngine', () => {
  it('applies hard deterministic limits before scoring and never lowers their outcome', () => {
    expect(evaluate({ maximumAmountMinor: 100, scores: [{ signal: 'trust.score', minimum: 1, points: 1 }], thresholds: { challenge: 1, review: 2, deny: 3 } }, { amountMinor: 101, signals: [riskSignal(0)] })).toMatchObject({
      outcome: 'deny',
      safeReason: 'amount',
      policy: { id: 'policy', version: 7 },
    });
    expect(evaluate({ reviewOperations: ['order.orders.create'], scores: [], thresholds: { challenge: 1, review: 2, deny: 3 } }).outcome).toBe('review');
    expect(evaluate({ blockedActors: ['actor'], denyOperations: ['order.orders.create'], maximumAmountMinor: 1 }, { amountMinor: 2 })).toMatchObject({ outcome: 'deny', safeReason: 'list' });
  });

  it('returns explainable evidence without persisting sensitive values', () => {
    const decision = evaluate({ scores: [{ signal: 'trust.score', minimum: 1, points: 9 }], thresholds: { challenge: 5, review: 8, deny: 10 } }, { signals: [riskSignal(3, 'sensitive')] });
    expect(decision).toMatchObject({ outcome: 'review', score: 9, action: { kind: 'requireverification', approvalRequired: false } });
    expect(decision.evidence.matchedRules).toContain('signal.trust.score');
    expect(decision.evidence.signals[0]).not.toHaveProperty('value');
  });

  it('only proposes whitelisted cross-domain actions and requires approval for high-impact actions', () => {
    const denied = { denyOperations: ['catalog.listings.publish'] };
    const decision = evaluate(denied, { operation: 'catalog.listings.publish', resource: 'listing:one' });
    expect(decision.action).toEqual({
      kind: 'suggestunlist',
      target: { module: 'catalog', type: 'resource', id: 'listing:one' },
      approvalRequired: true,
      rationale: 'risk.deny.catalog',
    });
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
