import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord } from '../../../../foundation/interface/Validation';
import type { ApplicationRepository } from '../port/ApplicationRepository';

export class ApplicationsUpdateHandler implements OperationHandler<'experience.applications.update', 'write'> {
  readonly operation = 'experience.applications.update' as const;
  readonly mode = 'write' as const;
  constructor(private readonly applications: ApplicationRepository) {}
  async execute(input: OperationInputFor<'experience.applications.update'>, context: WriteHandlerContext<'experience.applications.update'>): Promise<OperationReply<OperationOutputFor<'experience.applications.update'>>> {
    const body = bodyRecord(input);
    const updated = await this.applications.update(context.transaction, {
      id: input.path.applicationid,
      name: typeof body.name === 'string' ? body.name : null,
      status: typeof body.status === 'string' ? body.status : null,
      expectedVersion: context.expectedVersion ?? null,
    });
    return { status: 200, body: updated as unknown as OperationOutputFor<'experience.applications.update'> };
  }
}
