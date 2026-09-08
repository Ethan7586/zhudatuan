import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { ManageOwnershipTransfer } from '../process/ManageOwnershipTransfer';

export class OwnershipCancelPreviewHandler implements OperationHandler<'access.ownership.transfers.cancel.preview', 'write'> {
  readonly operation = 'access.ownership.transfers.cancel.preview' as const;
  readonly mode = 'write' as const;
  constructor(private readonly ownership: ManageOwnershipTransfer) {}
  async execute(
    input: OperationInputFor<'access.ownership.transfers.cancel.preview'>,
    context: WriteHandlerContext<'access.ownership.transfers.cancel.preview'>
  ): Promise<OperationReply<OperationOutputFor<'access.ownership.transfers.cancel.preview'>>> {
    return { status: 200, body: await this.ownership.previewCancel(input, context) };
  }
}
