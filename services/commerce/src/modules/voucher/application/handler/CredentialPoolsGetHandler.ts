import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class CredentialPoolsGetHandler implements OperationHandler<'voucher.credentialpools.get', 'read'> {
  readonly operation = 'voucher.credentialpools.get' as const;
  readonly mode = 'read' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'credentialpoolsGet'>) {}
  execute(input: OperationInputFor<'voucher.credentialpools.get'>, context: HandlerContext<'voucher.credentialpools.get'>): Promise<OperationReply<OperationOutputFor<'voucher.credentialpools.get'>>> {
    return this.application.credentialpoolsGet(input, context);
  }
}
