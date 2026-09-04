import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, textField } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ApplicationRepository } from '../port/ApplicationRepository';

export class ApplicationsCopyHandler implements OperationHandler<'experience.applications.copy', 'write'> {
  readonly operation = 'experience.applications.copy' as const;
  readonly mode = 'write' as const;
  constructor(private readonly applications: ApplicationRepository) {}
  async execute(input: OperationInputFor<'experience.applications.copy'>, context: WriteHandlerContext<'experience.applications.copy'>): Promise<OperationReply<OperationOutputFor<'experience.applications.copy'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const copied = await this.applications.copy(context.transaction, {
      source: input.path.applicationid,
      targetMall: textField(body, 'targetMallId'),
      actor: access.actor.id,
      reason: textField(body, 'reason', 500),
    });
    return { status: 201, body: copied as unknown as OperationOutputFor<'experience.applications.copy'> };
  }
}
