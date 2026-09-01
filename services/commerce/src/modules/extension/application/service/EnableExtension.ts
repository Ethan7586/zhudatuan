import { DomainError } from '../../../../foundation/domain/DomainError';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { HealthRecord } from '../../domain/model/HealthRecord';
import type { ExtensionRepository } from '../port/ExtensionLoader';

export class EnableExtension {
  constructor(private readonly repository: ExtensionRepository) {}

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
    const health = await repository.latestHealth(context, id, locked.version);
    if (!health || health.state !== 'healthy') throw new Error('EXTENSION_PROBES_REQUIRED');
    const activation = await repository.activation(context, id, scope, locked.extension);
    const current = activation.candidate;
    if (!['testing', 'degraded'].includes(current.state)) throw new Error('EXTENSION_CANDIDATE_STALE');
    await repository.health(context, new HealthRecord(current.id, current.version, health.state, health.checkedAt, health.latency));
    if (activation.active) await repository.transition(context, activation.active, 'disabled', actor, { reason: 'atomic replacement', replacement: current.id, trace });
    await repository.transition(context, current, 'enabled', actor, { reason: 'provider worker probes passed', health, trace });
    await repository.enqueueHealth(context, current.id, current.scope);
    return activation.active?.id ?? null;
  }
}
