import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class CredentialsGetHandler implements OperationHandler<'voucher.credentials.get', 'read'> {
  readonly operation = 'voucher.credentials.get' as const;
  readonly mode = 'read' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'credentialsGet'>) {}
  execute(input: OperationInputFor<'voucher.credentials.get'>, context: HandlerContext<'voucher.credentials.get'>): Promise<OperationReply<OperationOutputFor<'voucher.credentials.get'>>> {
    return this.application.credentialsGet(input, context);
  }
}
