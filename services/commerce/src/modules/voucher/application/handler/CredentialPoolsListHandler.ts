import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class CredentialPoolsListHandler implements OperationHandler<'voucher.credentialpools.list', 'read'> {
  readonly operation = 'voucher.credentialpools.list' as const;
  readonly mode = 'read' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'credentialpoolsList'>) {}
  execute(input: OperationInputFor<'voucher.credentialpools.list'>, context: HandlerContext<'voucher.credentialpools.list'>): Promise<OperationReply<OperationOutputFor<'voucher.credentialpools.list'>>> {
    return this.application.credentialpoolsList(input, context);
  }
}
