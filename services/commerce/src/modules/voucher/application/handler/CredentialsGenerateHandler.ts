import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class CredentialsGenerateHandler implements OperationHandler<'voucher.credentials.generate', 'write'> {
  readonly operation = 'voucher.credentials.generate' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'credentialsGenerate'>) {}
  execute(input: OperationInputFor<'voucher.credentials.generate'>, context: WriteHandlerContext<'voucher.credentials.generate'>): Promise<OperationReply<OperationOutputFor<'voucher.credentials.generate'>>> {
    return this.application.credentialsGenerate(input, context);
  }
}
