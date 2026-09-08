import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class CredentialPoolsCloseHandler implements OperationHandler<'voucher.credentialpools.close', 'write'> {
  readonly operation = 'voucher.credentialpools.close' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'credentialpoolsClose'>) {}
  execute(input: OperationInputFor<'voucher.credentialpools.close'>, context: WriteHandlerContext<'voucher.credentialpools.close'>): Promise<OperationReply<OperationOutputFor<'voucher.credentialpools.close'>>> {
    return this.application.credentialpoolsClose(input, context);
  }
}
