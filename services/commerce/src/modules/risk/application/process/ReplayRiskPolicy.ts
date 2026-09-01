import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';
import type { CatalogRiskDecisionPort } from '../../../catalog/public';
import { RiskPolicy, type RiskOutcome } from '../../domain/model/RiskPolicy';
import { signal } from '../../domain/model/Signal';
import { RiskEngine } from '../../domain/policy/RiskEngine';
import type { RiskReplayRepository } from '../port/RiskReplayRepository';

export interface RiskReplayExecution {
  readonly scope: string;
  readonly trace: string;
  readonly signal: AbortSignal;
  readonly deadline: number;
}

export class ReplayRiskPolicy {
  private readonly engine = new RiskEngine();

  constructor(
    private readonly transactions: TransactionManager,
    private readonly repository: RiskReplayRepository,
    private readonly catalog: CatalogRiskDecisionPort
  ) {}

  replay(policy: string, version: number, execution: RiskReplayExecution): Promise<void> {
    return this.transactions.write(this.options(execution), async (context) => {
      const selected = await this.repository.begin(context, policy, version);
      if (!selected) return;
      const candidate = new RiskPolicy(policy, version, selected.rule, 100);
      const samples = await this.repository.sample(context, selected.scope);
      const outcomes: Record<RiskOutcome, number> = { allow: 0, challenge: 0, review: 0, deny: 0 };
      let changed = 0;
      let falsePositives = 0;
      for (const previous of samples) {
        if (execution.signal.aborted) throw execution.signal.reason;
        const evidence = record(previous.evidence, 'RISK_REPLAY_EVIDENCE_INVALID');
        const result = this.engine.evaluate(candidate.rule, {
          actor: previous.actor,
          operation: previous.operation,
          amountMinor: optionalNumber(evidence.amountMinor),
          velocity: number(evidence.velocity, 0),
          blocked: evidence.blocked === true,
          signals: signalList(evidence.signals),
        });
        outcomes[result.outcome] += 1;
        if (result.outcome !== previous.outcome) changed += 1;
        if (previous.falsePositive) falsePositives += 1;
      }
      await this.repository.complete(context, policy, version, {
        sample: samples.length,
        changed,
        outcomes,
        changedRate: changed / Math.max(1, samples.length),
        falsePositiveRate: falsePositives / Math.max(1, samples.length),
      });
    });
  }

  applyCatalogDecision(decision: string, execution: RiskReplayExecution): Promise<void> {
    return this.transactions.write(this.options(execution), async (context) => {
      const command = await this.repository.catalogDecision(context, decision);
      if (command) await this.catalog.execute(context, { decision: command.decision, scope: command.scope, listing: command.resource });
    });
  }

  private options(execution: RiskReplayExecution) {
    return {
      tenant: execution.scope,
      membership: '',
      scope: execution.scope,
      actor: 'job:riskscan',
      trace: execution.trace,
      operation: 'job.risk.scan',
      workload: 'jobs' as const,
      signal: execution.signal,
      deadline: execution.deadline,
    };
  }
}

function signalList(value: unknown) {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(
    value.slice(0, 500).map((candidate) => {
      const item = record(candidate, 'RISK_REPLAY_SIGNAL_INVALID');
      return signal(text(item.type, 'RISK_REPLAY_SIGNAL_TYPE_INVALID'), number(item.value, 0), text(item.observedAt, 'RISK_REPLAY_SIGNAL_TIME_INVALID'));
    })
  );
}

function optionalNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : number(value, 0);
}

function number(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value) throw new Error(code);
  return value;
}

function record(value: unknown, code: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}
