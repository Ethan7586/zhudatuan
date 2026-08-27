import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { ApplyRiskDecision } from '../../../catalog/CatalogModule';
import { signal } from '../../domain/model/Signal';
import { RiskPolicy, type RiskOutcome } from '../../domain/model/RiskPolicy';
import { RiskEngine } from '../../domain/policy/RiskEngine';
import { PgRiskRepository } from '../../infrastructure/persistence/PgRiskRepository';
import { applyJobDatabaseContext } from '../../../../foundation/infrastructure/DatabaseContext';

export class RiskReplayJobProcessor implements JobProcessor {
  private readonly engine = new RiskEngine();
  constructor(private readonly pool: DatabasePool) {}

  async process(job: ClaimedJob, abort: AbortSignal): Promise<void> {
    if (job.kind !== 'riskscan') throw new Error('JOB_KIND_MISMATCH');
    if (abort.aborted) throw abort.reason;
    const payload = record(job.payload, 'JOB_PAYLOAD_INVALID');
    if (typeof payload.catalogDecision === 'string') return this.applyCatalogDecision(payload.catalogDecision, abort);
    await this.replay(text(payload.policy, 'RISK_POLICY_REQUIRED'), integer(payload.version, 'RISK_POLICY_VERSION_REQUIRED'), abort);
  }

  private async replay(policyid: string, version: number, abort: AbortSignal): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await applyJobDatabaseContext(client);
      const repository = new PgRiskRepository(client); const selected = await repository.replay(policyid, version);
      if (!selected) { await client.query('commit'); return; }
      const policy = new RiskPolicy(policyid, version, selected.rule, 100); const sample = await repository.replaySample(selected.scope);
      const outcomes: Record<RiskOutcome, number> = { allow: 0, challenge: 0, review: 0, deny: 0 };
      let changed = 0; let falsePositives = 0;
      for (const previous of sample) {
        if (abort.aborted) throw abort.reason;
        const evidence = record(previous.evidence, 'RISK_REPLAY_EVIDENCE_INVALID');
        const result = this.engine.evaluate(policy.rule, { actor: previous.actor, operation: previous.operation,
          amountMinor: optionalNumber(evidence.amountMinor), velocity: number(evidence.velocity, 0), blocked: evidence.blocked === true,
          signals: signalList(evidence.signals) });
        outcomes[result.outcome] += 1;
        if (result.outcome !== previous.outcome) changed += 1;
        if (previous.falsePositive) falsePositives += 1;
      }
      await repository.completeReplay(policyid, version, { sample: sample.length, changed, outcomes,
        changedRate: changed/Math.max(1, sample.length), falsePositiveRate: falsePositives/Math.max(1, sample.length) });
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }

  private async applyCatalogDecision(decisionid: string, abort: AbortSignal): Promise<void> {
    if (abort.aborted) throw abort.reason;
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await applyJobDatabaseContext(client);
      const command = await new PgRiskRepository(client).catalogDecision(decisionid);
      if (command) await new ApplyRiskDecision().execute(client, { decision: command.decision, scope: command.scope, listing: command.resource });
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }
}

function signalList(value: unknown) {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(value.slice(0, 500).map((candidate) => { const item = record(candidate, 'RISK_REPLAY_SIGNAL_INVALID');
    return signal(text(item.type, 'RISK_REPLAY_SIGNAL_TYPE_INVALID'), number(item.value, 0), text(item.observedAt, 'RISK_REPLAY_SIGNAL_TIME_INVALID')); }));
}
function optionalNumber(value: unknown): number | null { return value === null || value === undefined ? null : number(value, 0); }
function number(value: unknown, fallback: number): number { return typeof value === 'number' && Number.isFinite(value) ? value : fallback; }
function integer(value: unknown, code: string): number { if (!Number.isSafeInteger(value) || (value as number) < 1) throw new Error(code); return value as number; }
function text(value: unknown, code: string): string { if (typeof value !== 'string' || !value) throw new Error(code); return value; }
function record(value: unknown, code: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}
