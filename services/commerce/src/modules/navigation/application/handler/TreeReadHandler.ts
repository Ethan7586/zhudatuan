import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ReadNavigationTree } from '../service/ReadNavigationTree';

export class TreeReadHandler implements OperationHandler<'navigation.tree.read', 'read'> {
  readonly operation = 'navigation.tree.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly tree: ReadNavigationTree) {}

  async execute(input: OperationInputFor<'navigation.tree.read'>, context: HandlerContext<'navigation.tree.read'>): Promise<OperationReply<OperationOutputFor<'navigation.tree.read'>>> {
    const value = input.query?.scopeid;
    if (value !== undefined && typeof value !== 'string') throw new DomainError('VALIDATION_FAILED', { field: 'scopeid' });
    const result = await this.tree.execute(context.transaction, requireSession(context.security), value, { signal: context.signal, deadline: context.deadline });
    return result as unknown as OperationReply<OperationOutputFor<'navigation.tree.read'>>;
  }
}
