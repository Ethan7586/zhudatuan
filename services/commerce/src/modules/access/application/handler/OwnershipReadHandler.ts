import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { ManageOwnershipTransfer } from '../process/ManageOwnershipTransfer';

export class OwnershipReadHandler implements OperationHandler<'access.ownership.read', 'read'> {
  readonly operation = 'access.ownership.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly ownership: ManageOwnershipTransfer) {}
  async execute(input: OperationInputFor<'access.ownership.read'>, context: HandlerContext<'access.ownership.read'>): Promise<OperationReply<OperationOutputFor<'access.ownership.read'>>> {
    return { status: 200, body: await this.ownership.read(input, context) };
  }
}
