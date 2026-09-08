import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class JobsGetHandler implements OperationHandler<'voucher.jobs.get', 'read'> {
  readonly operation = 'voucher.jobs.get' as const;
  readonly mode = 'read' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'jobsGet'>) {}
  execute(input: OperationInputFor<'voucher.jobs.get'>, context: HandlerContext<'voucher.jobs.get'>): Promise<OperationReply<OperationOutputFor<'voucher.jobs.get'>>> {
    return this.application.jobsGet(input, context);
  }
}
