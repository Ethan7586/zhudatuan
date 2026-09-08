import { DomainError } from '../../../../platform/error/DomainError';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ExtensionLoader, ExtensionRepository } from '../port/ExtensionLoader';

export class DisableExtension {
  constructor(
    private readonly repository: ExtensionRepository,
    private readonly loader: ExtensionLoader
  ) {}

  async execute(context: WriteTransactionContext, id: string, scope: string, actor: string, trace: string): Promise<string> {
    const repository = this.repository;
    const current = await repository.lock(context, id, scope);
    if (!current) throw new DomainError('RESOURCE_NOT_FOUND');
    if (current.state !== 'disabled') {
      const drain = await this.loader.disable(current.extension, current.scope, context.deadline);
      await repository.transition(context, current, 'disabled', actor, { reason: 'operator disabled', drain, trace });
    }
    return current.extension;
  }
}
