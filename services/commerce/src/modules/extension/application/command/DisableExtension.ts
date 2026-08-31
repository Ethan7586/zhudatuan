import { DomainError } from '../../../../foundation/domain/DomainError';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { ExtensionRepositoryFactory } from '../port/ExtensionLoader';

export class DisableExtension {
  constructor(private readonly repositories: ExtensionRepositoryFactory) {}

  async execute(database: OperationDatabase, id: string, scope: string, actor: string, trace: string): Promise<string> {
    const repository = this.repositories(database);
    const current = await repository.lock(id, scope);
    if (!current) throw new DomainError('RESOURCE_NOT_FOUND');
    if (current.state !== 'disabled') await repository.transition(current, 'disabled', actor, { reason: 'operator disabled', trace });
    return current.extension;
  }
}
