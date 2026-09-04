import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { keysetPage, queryPage } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { CommissionRepository } from '../port/CommissionRepository';

export class CommissionsReadHandler implements OperationHandler<'referral.commissions.read', 'read'> {
  readonly operation = 'referral.commissions.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly commissions: CommissionRepository) {}
  async execute(input: OperationInputFor<'referral.commissions.read'>, context: HandlerContext<'referral.commissions.read'>): Promise<OperationReply<OperationOutputFor<'referral.commissions.read'>>> {
    const page = queryPage(input);
    const rows = await this.commissions.read(context.transaction, requireSession(context.security).scope.id, null, page);
    return { status: 200, body: keysetPage(rows, page, 'id') as OperationOutputFor<'referral.commissions.read'> };
  }
}
