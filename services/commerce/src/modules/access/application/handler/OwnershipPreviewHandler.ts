import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { ManageOwnershipTransfer } from '../process/ManageOwnershipTransfer';

export class OwnershipPreviewHandler implements OperationHandler<'access.ownership.transfers.preview', 'write'> {
  readonly operation = 'access.ownership.transfers.preview' as const;
  readonly mode = 'write' as const;
  constructor(private readonly ownership: ManageOwnershipTransfer) {}
  async execute(input: OperationInputFor<'access.ownership.transfers.preview'>, context: WriteHandlerContext<'access.ownership.transfers.preview'>): Promise<OperationReply<OperationOutputFor<'access.ownership.transfers.preview'>>> {
    return { status: 200, body: await this.ownership.previewCreate(input, context) };
  }
}
