import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ManageMalls } from '../service/ManageMalls';

export class MallsReadHandler implements OperationHandler<'organization.malls.read', 'read'> {
  readonly operation = 'organization.malls.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly malls: ManageMalls) {}
  async execute(input: OperationInputFor<'organization.malls.read'>, context: HandlerContext<'organization.malls.read'>): Promise<OperationReply<OperationOutputFor<'organization.malls.read'>>> {
    const access = requireSession(context.security);
    const mall = await this.malls.read(context.transaction, input.path.mallid, access.scope.id);
    return { status: 200, body: mall.view() as OperationOutputFor<'organization.malls.read'>, headers: { etag: `"${mall.version}"` } };
  }
}
