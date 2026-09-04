import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class CredentialExportsCreateHandler implements OperationHandler<'voucher.credentialexports.create', 'write'> {
  readonly operation = 'voucher.credentialexports.create' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'credentialexportsCreate'>) {}
  execute(input: OperationInputFor<'voucher.credentialexports.create'>, context: WriteHandlerContext<'voucher.credentialexports.create'>): Promise<OperationReply<OperationOutputFor<'voucher.credentialexports.create'>>> {
    return this.application.credentialexportsCreate(input, context);
  }
}
