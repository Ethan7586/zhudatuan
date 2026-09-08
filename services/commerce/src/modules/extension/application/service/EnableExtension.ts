import { DomainError } from '../../../../platform/error/DomainError';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { HealthRecord } from '../../domain/model/HealthRecord';
import type { ExtensionCandidate, ExtensionLoader, ExtensionRepository } from '../port/ExtensionLoader';

export class EnableExtension {
  constructor(
    private readonly repository: ExtensionRepository,
    private readonly loader: ExtensionLoader
  ) {}

  async test(context: WriteTransactionContext, id: string, scope: string, actor: string, trace: string): Promise<void> {
    const repository = this.repository;
    const current = await repository.lock(context, id, scope);
    if (!current) throw new DomainError('RESOURCE_NOT_FOUND');
    if (current.state === 'disabled' || current.state === 'degraded') await repository.transition(context, current, 'testing', actor, { reason: 'health test', trace });
    else if (current.state !== 'testing') throw new Error(`EXTENSION_STATE_INVALID:${current.state}:testing`);
    await repository.enqueueHealth(context, id, scope);
  }

  async enable(context: WriteTransactionContext, id: string, scope: string, actor: string, trace: string): Promise<string | null> {
    const repository = this.repository;
    const locked = await repository.lock(context, id, scope);
    if (!locked) throw new DomainError('RESOURCE_NOT_FOUND');
    if (!['testing', 'degraded'].includes(locked.state)) throw new Error('EXTENSION_CANDIDATE_STALE');
    let candidate: ExtensionCandidate | undefined;
    try {
      candidate = await this.loader.stage(id, loadContext(context, scope, actor, trace));
      if (candidate.installation !== locked.id || candidate.version !== locked.version || candidate.provider !== locked.extension || candidate.scope !== locked.scope) throw new Error('EXTENSION_CANDIDATE_STALE');
      if (candidate.health.state !== 'healthy' || candidate.probes.sandbox.state !== 'healthy' || candidate.probes.canary.state !== 'healthy') throw new Error('EXTENSION_PROBES_REQUIRED');
      const activation = await repository.activation(context, id, scope, locked.extension);
      const current = activation.candidate;
      if (current.version !== locked.version || !['testing', 'degraded'].includes(current.state)) throw new Error('EXTENSION_CANDIDATE_STALE');
      await repository.health(context, new HealthRecord(current.id, current.version, candidate.health.state, candidate.health.checkedAt, candidate.latency));
      if (activation.active) await repository.transition(context, activation.active, 'disabled', actor, { reason: 'atomic replacement', replacement: current.id, trace });
      await repository.transition(context, current, 'enabled', actor, { reason: 'contract, configuration, sandbox and health probes passed', probes: candidate.probes, trace });
      await repository.enqueueHealth(context, current.id, current.scope);
      await this.loader.activate(candidate);
      return activation.active?.id ?? null;
    } catch (cause) {
      if (candidate) await this.loader.discard(candidate).catch(() => undefined);
      throw cause;
    }
  }
}

function loadContext(context: WriteTransactionContext, scope: string, actor: string, trace: string) {
  return { tenant: context.tenant, membership: context.membership, scope, actor, trace, workload: 'query' as const, deadline: context.deadline, signal: context.signal };
}
