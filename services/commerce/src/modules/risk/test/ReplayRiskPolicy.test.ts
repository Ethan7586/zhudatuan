import { describe, expect, it, vi } from 'vitest';
import type { TransactionManager } from '../../../foundation/persistence/TransactionManager';
import type { RiskReplayRepository } from '../application/port/RiskReplayRepository';
import { ReplayRiskPolicy } from '../application/process/ReplayRiskPolicy';

describe('ReplayRiskPolicy', () => {
  it('only writes a simulation preview and never calls a target domain', async () => {
    const complete = vi.fn().mockResolvedValue(undefined);
    const repository = {
      begin: vi.fn().mockResolvedValue({ scope: 'mall:one', rule: { maximumAmountMinor: 100 } }),
      sample: vi.fn().mockResolvedValue([
        {
          actor: 'member:one', operation: 'catalog.listings.publish', resource: 'listing:one', outcome: 'allow', falsePositive: false,
          evidence: { context: { amountMinor: 101, velocity: 0, blocked: false }, signals: [] },
        },
      ]),
      complete,
    } as unknown as RiskReplayRepository;
    const context = Object.freeze({ mode: 'write' }) as never;
    const transactions = { write: vi.fn(async (_options, operation) => operation(context)) } as unknown as TransactionManager;
    const replay = new ReplayRiskPolicy(transactions, repository);
    await replay.replay('policy:one', 2, { scope: 'mall:one', trace: 'trace:one', signal: new AbortController().signal, deadline: Date.now() + 1_000 });
    expect(complete).toHaveBeenCalledWith(context, 'policy:one', 2, expect.objectContaining({ sample: 1, changed: 1, outcomes: { allow: 0, challenge: 0, review: 0, deny: 1 } }));
    expect(Object.getOwnPropertyNames(ReplayRiskPolicy.prototype)).toEqual(['constructor', 'replay', 'options']);
  });
});
