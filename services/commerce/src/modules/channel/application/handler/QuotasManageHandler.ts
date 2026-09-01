import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, integerField, textField } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { DistributorRepository } from '../port/DistributorRepository';

export class QuotasManageHandler implements OperationHandler<'channel.quotas.manage', 'write'> {
  readonly operation = 'channel.quotas.manage' as const;
  readonly mode = 'write' as const;
  constructor(private readonly distributors: DistributorRepository) {}
  async execute(input: OperationInputFor<'channel.quotas.manage'>, context: WriteHandlerContext<'channel.quotas.manage'>): Promise<OperationReply<OperationOutputFor<'channel.quotas.manage'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const result = await this.distributors.manageQuota(context.transaction, {
      id: input.path.quotaid,
      scope: access.scope.id,
      capability: textField(body, 'capability'),
      state: body.state === 'disabled' ? 'disabled' : 'enabled',
      quota: body.quota === null ? null : integerField(body, 'quota'),
      expiresAt: body.expiresAt ?? null,
      expectedVersion: context.expectedVersion ?? null,
    });
    return { status: 200, body: result as OperationOutputFor<'channel.quotas.manage'> };
  }
}
