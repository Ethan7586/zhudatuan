import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { SlaRepository } from '../port/SupportRepositories';

export class SlaReadHandler implements OperationHandler<'support.slas.read', 'read'> {
  readonly operation = 'support.slas.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly slas: SlaRepository) {}
  execute(input: OperationInputFor<'support.slas.read'>, context: HandlerContext<'support.slas.read'>): Promise<OperationReply<OperationOutputFor<'support.slas.read'>>> {
    const transaction = context.transaction;
    return this.slas.readSlas(transaction, input, context);
  }
}
