import { DomainError } from '../../../../foundation/domain/DomainError';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { HealthRecord } from '../../domain/model/HealthRecord';
import type { ExtensionRepositoryFactory } from '../port/ExtensionLoader';

export class EnableExtension {
  constructor(private readonly repositories: ExtensionRepositoryFactory) {}

  async test(database: OperationDatabase, id: string, scope: string, actor: string, trace: string): Promise<void> {
    const repository = this.repositories(database);
    const current = await repository.lock(id, scope);
    if (!current) throw new DomainError('RESOURCE_NOT_FOUND');
    if (current.state === 'disabled' || current.state === 'degraded') await repository.transition(current, 'testing', actor, { reason: 'health test', trace });
    else if (current.state !== 'testing') throw new Error(`EXTENSION_STATE_INVALID:${current.state}:testing`);
    await repository.enqueueHealth(id, scope);
  }

  async enable(database: OperationDatabase, id: string, scope: string, actor: string, trace: string): Promise<string | null> {
    const repository = this.repositories(database);
    const locked = await repository.lock(id, scope);
    if (!locked) throw new DomainError('RESOURCE_NOT_FOUND');
    const health = await repository.latestHealth(id, locked.version);
    if (!health || health.state !== 'healthy') throw new Error('EXTENSION_PROBES_REQUIRED');
    const activation = await repository.activation(id, scope, locked.extension);
    const current = activation.candidate;
    if (!['testing', 'degraded'].includes(current.state)) throw new Error('EXTENSION_CANDIDATE_STALE');
    await repository.health(new HealthRecord(current.id, current.version, health.state, health.checkedAt, health.latency));
    if (activation.active) await repository.transition(activation.active, 'disabled', actor, { reason: 'atomic replacement', replacement: current.id, trace });
    await repository.transition(current, 'enabled', actor, { reason: 'provider worker probes passed', health, trace });
    await repository.enqueueHealth(current.id, current.scope);
    return activation.active?.id ?? null;
  }
}
