import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { ManageOwnershipTransfer } from '../process/ManageOwnershipTransfer';

export class OwnershipAcceptPreviewHandler implements OperationHandler<'access.ownership.transfers.accept.preview', 'write'> {
  readonly operation = 'access.ownership.transfers.accept.preview' as const;
  readonly mode = 'write' as const;
  constructor(private readonly ownership: ManageOwnershipTransfer) {}
  async execute(
    input: OperationInputFor<'access.ownership.transfers.accept.preview'>,
    context: WriteHandlerContext<'access.ownership.transfers.accept.preview'>
  ): Promise<OperationReply<OperationOutputFor<'access.ownership.transfers.accept.preview'>>> {
    return { status: 200, body: await this.ownership.previewAccept(input, context) };
  }
}
