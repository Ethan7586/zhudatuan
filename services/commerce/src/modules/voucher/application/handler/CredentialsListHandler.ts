import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class CredentialsListHandler implements OperationHandler<'voucher.credentials.list', 'read'> {
  readonly operation = 'voucher.credentials.list' as const;
  readonly mode = 'read' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'credentialsList'>) {}
  execute(input: OperationInputFor<'voucher.credentials.list'>, context: HandlerContext<'voucher.credentials.list'>): Promise<OperationReply<OperationOutputFor<'voucher.credentials.list'>>> {
    return this.application.credentialsList(input, context);
  }
}
