import { RUNTIME_LIMITS } from '@shop/config/runtime';
import type { ProviderHealth } from '@shop/contract';
import { CircuitBreaker } from '@shop/kernel';
import { Deadline } from '@shop/kernel';
import type { ProviderMetrics } from '../../../../platform/telemetry/ProviderMetrics';
import { safeErrorCode } from '../../../../platform/error/SafeError';
import type { TransactionManager } from '../../../../platform/database/TransactionManager';
import { HealthRecord } from '../../domain/model/HealthRecord';
import type { ExtensionCandidate, ExtensionLoader, ExtensionRepository } from '../port/ExtensionLoader';
import type { ExtensionStateSink } from '../../public';

export interface ExtensionMonitorPolicy {
  readonly timeout: number;
  readonly failures: number;
  readonly recovery: number;
  readonly interval: number;
}

const DEFAULT_POLICY: ExtensionMonitorPolicy = Object.freeze({
  timeout: RUNTIME_LIMITS.external.totalDeadlineMilliseconds,
  failures: RUNTIME_LIMITS.external.failureThreshold,
  recovery: RUNTIME_LIMITS.external.recoveryMilliseconds,
  interval: RUNTIME_LIMITS.external.recoveryMilliseconds,
});

export class MonitorExtensions {
  private readonly circuits = new Map<string, CircuitBreaker>();

  constructor(
    private readonly transactions: TransactionManager,
    private readonly repository: ExtensionRepository,
    private readonly loader: ExtensionLoader,
    private readonly states: ExtensionStateSink,
    private readonly metrics: ProviderMetrics,
    private readonly policy: ExtensionMonitorPolicy = DEFAULT_POLICY
  ) {
    if (
      ![policy.timeout, policy.failures, policy.recovery, policy.interval].every((value) => Number.isSafeInteger(value) && value > 0) ||
      policy.timeout > 300_000 ||
      policy.failures > 100 ||
      policy.recovery > 3_600_000 ||
      policy.interval > 86_400_000
    ) {
      throw new Error('EXTENSION_MONITOR_POLICY_INVALID');
    }
  }

  async check(installation: string, scope: string, trace: string, signal: AbortSignal, deadline: number): Promise<void> {
    const started = performance.now();
    const telemetry = { requestId: trace, traceId: trace, scopeId: scope, module: 'extension', operation: 'extension.health' };
    let candidate: ExtensionCandidate;
    try {
      candidate = await this.circuit(installation).run(async () => {
        const staged = await this.stage(installation, scope, trace, signal, deadline);
        if (staged.health.state !== 'healthy') throw new ProbeFailure(staged);
        return staged;
      });
      this.metrics.observe(candidate.provider, 'health', telemetry, performance.now() - started, 'success');
    } catch (cause) {
      if (signal.aborted) throw signal.reason;
      const failed = cause instanceof ProbeFailure ? cause.candidate : undefined;
      const code = failureCode(cause, failed);
      this.metrics.observe(failed?.provider ?? installation, 'health', telemetry, performance.now() - started, 'failure', code);
      await this.recordFailure(installation, scope, trace, signal, deadline, failed, code);
      if (failed) await this.loader.discard(failed).catch(() => undefined);
      return;
    }

    let activate = false;
    let consumed = false;
    try {
      await this.transactions.write(options(trace, scope, signal, deadline), async (context) => {
        const current = await this.repository.lock(context, installation, scope);
        if (!current || !['testing', 'enabled', 'degraded'].includes(current.state)) {
          this.circuits.delete(installation);
          return;
        }
        await this.repository.enqueueHealth(context, installation, scope, intervalSeconds(this.policy.interval));
        if (current.version !== candidate.version) return;
        await this.repository.health(context, new HealthRecord(current.id, current.version, candidate.health.state, candidate.health.checkedAt, candidate.latency));
        if (current.state === 'enabled') {
          activate = !this.loader.active(candidate);
          return;
        }
        if (current.state === 'degraded') {
          const activation = await this.repository.activation(context, current.id, current.scope, current.extension);
          if (activation.active) return;
          await this.repository.transition(context, current, 'enabled', 'system:extensionhealth', { reason: 'provider recovered after contract and canary probes', probes: candidate.probes, trace });
          await this.states.recover(context, current.id, current.scope);
          activate = true;
        }
      });
      if (activate) {
        await this.loader.activate(candidate);
        consumed = true;
      }
    } finally {
      if (!consumed) await this.loader.discard(candidate);
    }
  }

  async scan(signal: AbortSignal, deadline: number): Promise<void> {
    await this.loader.reconcile(signal, Math.min(deadline, Date.now() + this.policy.timeout));
    await this.transactions.write(options('extensionhealth:scan', 'extension', signal, deadline), async (context) => {
      const targets = await this.repository.targets(context, 100);
      const active = new Set(targets.map(({ id }) => id));
      for (const id of this.circuits.keys()) if (!active.has(id)) this.circuits.delete(id);
      for (const target of targets) {
        if (signal.aborted) throw signal.reason;
        await this.repository.enqueueHealth(context, target.id, target.scope_id);
      }
      await this.repository.enqueueScan(context, targets.length === 100 ? 1 : intervalSeconds(this.policy.interval));
    });
  }

  private circuit(installation: string): CircuitBreaker {
    const current = this.circuits.get(installation);
    if (current) return current;
    const created = new CircuitBreaker(this.policy.failures, this.policy.recovery);
    this.circuits.set(installation, created);
    return created;
  }

  private async stage(installation: string, scope: string, trace: string, signal: AbortSignal, deadline: number): Promise<ExtensionCandidate> {
    const bounded = Deadline.at(Math.min(deadline, Date.now() + this.policy.timeout), signal);
    const operation = this.loader.stage(installation, {
      tenant: '',
      membership: '',
      scope,
      actor: 'system:extensionhealth',
      trace,
      workload: 'worker',
      signal: bounded.signal,
      deadline: bounded.expiresAt,
    });
    try {
      return await bounded.run(() => operation);
    } catch (cause) {
      void operation.then(
        (candidate) => this.loader.discard(candidate).catch(() => undefined),
        () => undefined
      );
      if (!signal.aborted && cause instanceof Error && cause.message === 'DEADLINE_EXCEEDED') throw new ProbeTimeout(cause);
      throw cause;
    } finally {
      bounded.dispose();
    }
  }

  private async recordFailure(installation: string, scope: string, trace: string, signal: AbortSignal, deadline: number, candidate: ExtensionCandidate | undefined, reason: string): Promise<void> {
    await this.transactions.write(options(trace, scope, signal, deadline), async (context) => {
      const current = await this.repository.lock(context, installation, scope);
      if (!current || !['testing', 'enabled', 'degraded'].includes(current.state)) {
        this.circuits.delete(installation);
        return;
      }
      const health = candidate?.health ?? unavailable(reason);
      const latency = candidate?.latency ?? 0;
      await this.repository.health(context, new HealthRecord(current.id, current.version, health.state, health.checkedAt, latency, health.reason ?? reason));
      if (current.state === 'enabled') {
        const drain = await this.loader.disable(current.extension, current.scope, deadline);
        await this.repository.transition(context, current, 'degraded', 'system:extensionhealth', { reason, health, latency, drain, trace });
        await this.states.degrade(context, installation, scope);
      }
      await this.repository.enqueueHealth(context, installation, scope, intervalSeconds(this.policy.interval));
    });
  }
}

class ProbeFailure extends Error {
  constructor(readonly candidate: ExtensionCandidate) {
    super('EXTENSION_HEALTH_DEGRADED');
  }
}

class ProbeTimeout extends Error {
  constructor(cause: unknown) {
    super('EXTENSION_HEALTH_TIMEOUT', { cause });
  }
}

function failureCode(cause: unknown, candidate?: ExtensionCandidate): string {
  if (cause instanceof ProbeTimeout) return cause.message;
  if (cause instanceof Error && cause.message === 'CIRCUIT_OPEN') return 'EXTENSION_HEALTH_CIRCUIT_OPEN';
  const reason = candidate?.health.reason;
  return reason && /^[A-Z][A-Z0-9_]{2,100}$/.test(reason) ? reason : safeErrorCode(cause, candidate ? 'EXTENSION_HEALTH_DEGRADED' : 'EXTENSION_HEALTH_FAILED');
}

function unavailable(reason: string): ProviderHealth {
  return Object.freeze({ state: 'unavailable', checkedAt: new Date().toISOString(), reason });
}

function intervalSeconds(milliseconds: number): number {
  return Math.max(1, Math.ceil(milliseconds / 1_000));
}

function options(trace: string, scope: string, signal: AbortSignal, deadline: number) {
  return { tenant: '', membership: '', scope, actor: 'job:extensionhealth', trace, operation: 'job.extension.health', workload: 'jobs' as const, signal, deadline };
}
