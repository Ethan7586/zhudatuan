import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { queryPage } from '../../../../foundation/interface/Validation';
import { organizationScope } from '../../../../foundation/security/OrganizationScope';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { RecoveryRepository } from '../port/RecoveryRepository';

export class RecoveriesReadHandler implements OperationHandler<'payment.recoveries.read', 'read'> {
  readonly operation = 'payment.recoveries.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly recoveries: RecoveryRepository) {}

  async execute(input: OperationInputFor<'payment.recoveries.read'>, context: HandlerContext<'payment.recoveries.read'>): Promise<OperationReply<OperationOutputFor<'payment.recoveries.read'>>> {
    const access = requireSession(context.security);
    const body = await this.recoveries.read(context.transaction, { scope: organizationScope(access.scope), page: queryPage(input) });
    return { status: 200, body: body as OperationOutputFor<'payment.recoveries.read'> };
  }
}
