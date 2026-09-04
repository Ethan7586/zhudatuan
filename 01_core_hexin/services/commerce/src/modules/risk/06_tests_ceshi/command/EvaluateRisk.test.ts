import { describe, expect, it, vi } from 'vitest';
import type { RiskRepository } from '../../01_public_gongkai/RiskCheck';
import { EvaluateRisk } from '../../03_application_yingyong/command/EvaluateRisk';

const input = Object.freeze({ actor: 'actor', operation: 'payment.intents.create', resource: 'order', scope: 'mall', scopes: ['group','mall'],
  trace: 'trace', amountMinor: 101, signals: [] });

describe('EvaluateRisk', () => {
  it('returns a persisted decision with only a safe reason', async () => {
    const decision = vi.fn().mockResolvedValue('riskdecision:1');
    const repository = { policies: vi.fn().mockResolvedValue([{ id: 'policy', scope: 'mall', activeVersion: 1,
      activeRule: { maximumAmountMinor: 100 }, activeRollout: 100, baselineVersion: null, baselineRule: null }]),
    signals: vi.fn().mockResolvedValue([]), blocked: vi.fn().mockResolvedValue(false),
    velocities: vi.fn().mockResolvedValue(new Map([[3600, 0]])), decision } as unknown as RiskRepository;
    await expect(new EvaluateRisk(repository).check(input)).resolves.toEqual({ outcome: 'deny', safeReason: 'amount', decision: 'riskdecision:1' });
    expect(decision).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'deny', safeReason: 'amount', score: 0 }));
  });

  it('allows without fabricating a decision when no policy applies', async () => {
    const decision = vi.fn();
    const repository = { policies: vi.fn().mockResolvedValue([]), decision } as unknown as RiskRepository;
    await expect(new EvaluateRisk(repository).check(input)).resolves.toEqual({ outcome: 'allow', safeReason: 'policy', decision: null });
    expect(decision).not.toHaveBeenCalled();
  });
});
