import { DomainError } from '../../../../foundation/domain/DomainError';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ExtensionRepository } from '../port/ExtensionLoader';

export class DisableExtension {
  constructor(private readonly repository: ExtensionRepository) {}

  async execute(context: WriteTransactionContext, id: string, scope: string, actor: string, trace: string): Promise<string> {
    const repository = this.repository;
    const current = await repository.lock(context, id, scope);
    if (!current) throw new DomainError('RESOURCE_NOT_FOUND');
    if (current.state !== 'disabled') await repository.transition(context, current, 'disabled', actor, { reason: 'operator disabled', trace });
    return current.extension;
  }
}
