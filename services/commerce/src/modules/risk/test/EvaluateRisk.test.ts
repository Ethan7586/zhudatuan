import { describe, expect, it, vi } from 'vitest';
import type { RiskRepository } from '../application/port/RiskCheck';
import { EvaluateRisk } from '../application/service/EvaluateRisk';

const request = (risk: 'low' | 'elevated' | 'high' | 'critical' = 'high') =>
  Object.freeze({
    actor: 'actor', operation: 'order.orders.create', resource: 'order', scope: 'mall', scopes: ['group', 'mall'], trace: 'trace', amountMinor: 101,
    signals: [], risk, mode: 'sync' as const, deadline: Date.now() + 1_000, signal: new AbortController().signal,
  });

describe('EvaluateRisk', () => {
  it('returns a persisted decision with only a safe reason', async () => {
    const decision = vi.fn().mockResolvedValue('riskdecision:1');
    const repository = {
      policies: vi.fn().mockResolvedValue([{ id: 'policy', scope: 'mall', activeVersion: 1, activeRule: { maximumAmountMinor: 100 }, activeRollout: 100, baselineVersion: null, baselineRule: null }]),
      signals: vi.fn().mockResolvedValue([]),
      blocked: vi.fn().mockResolvedValue(false),
      velocities: vi.fn().mockResolvedValue(new Map([[3600, 0]])),
      decision,
      defer: vi.fn(),
    } as unknown as RiskRepository;
    await expect(new EvaluateRisk(repository).check(request())).resolves.toEqual({ outcome: 'deny', safeReason: 'amount', decision: 'riskdecision:1' });
    expect(decision).toHaveBeenCalledWith(expect.objectContaining({ draft: expect.objectContaining({ outcome: 'deny', safeReason: 'amount', score: 0 }) }));
  });

  it('allows without fabricating a decision when no policy applies', async () => {
    const decision = vi.fn();
    const repository = { policies: vi.fn().mockResolvedValue([]), decision } as unknown as RiskRepository;
    await expect(new EvaluateRisk(repository).check(request())).resolves.toEqual({ outcome: 'allow', safeReason: 'policy', decision: null });
    expect(decision).not.toHaveBeenCalled();
  });

  it('uses configured fail-open and fail-closed outcomes when the strict deadline expires', async () => {
    const repository = { policies: vi.fn().mockRejectedValue(new Error('DEADLINE_EXCEEDED')) } as unknown as RiskRepository;
    await expect(new EvaluateRisk(repository).check(request('low'))).resolves.toEqual({ outcome: 'allow', safeReason: 'timeout', decision: null });
    await expect(new EvaluateRisk(repository).check(request('critical'))).resolves.toEqual({ outcome: 'deny', safeReason: 'timeout', decision: null });
  });

  it('defers complex policies instead of evaluating them in a synchronous request', async () => {
    const scores = Array.from({ length: 21 }, (_, index) => ({ signal: `device.score${index}`, minimum: 1, points: 1 }));
    const defer = vi.fn().mockResolvedValue('riskassessment:one');
    const repository = {
      policies: vi.fn().mockResolvedValue([{ id: 'policy', scope: 'mall', activeVersion: 1, activeRule: { scores }, activeRollout: 100, baselineVersion: null, baselineRule: null }]),
      defer,
    } as unknown as RiskRepository;
    await expect(new EvaluateRisk(repository).check(request('high'))).resolves.toEqual({ outcome: 'deny', safeReason: 'dependency', decision: null });
    expect(defer).toHaveBeenCalledOnce();
  });
});
