import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class CredentialPoolsCreateHandler implements OperationHandler<'voucher.credentialpools.create', 'write'> {
  readonly operation = 'voucher.credentialpools.create' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'credentialpoolsCreate'>) {}
  execute(input: OperationInputFor<'voucher.credentialpools.create'>, context: WriteHandlerContext<'voucher.credentialpools.create'>): Promise<OperationReply<OperationOutputFor<'voucher.credentialpools.create'>>> {
    return this.application.credentialpoolsCreate(input, context);
  }
}
