import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class CredentialsImportHandler implements OperationHandler<'voucher.credentials.import', 'write'> {
  readonly operation = 'voucher.credentials.import' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'credentialsImport'>) {}
  execute(input: OperationInputFor<'voucher.credentials.import'>, context: WriteHandlerContext<'voucher.credentials.import'>): Promise<OperationReply<OperationOutputFor<'voucher.credentials.import'>>> {
    return this.application.credentialsImport(input, context);
  }
}
