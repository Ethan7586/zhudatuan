import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { encodeCursor, queryPage } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { RiskAdministrationRepository } from '../port/RiskAdministrationRepository';

export class CenterReadHandler implements OperationHandler<'risk.center.read', 'read'> {
  readonly operation = 'risk.center.read' as const;
  readonly mode = 'read' as const;

  constructor(private readonly risks: RiskAdministrationRepository) {}

  async execute(input: OperationInputFor<'risk.center.read'>, context: HandlerContext<'risk.center.read'>): Promise<OperationReply<OperationOutputFor<'risk.center.read'>>> {
    const access = requireSession(context.security);
    const page = queryPage(input, 200);
    const rows = await this.risks.center(context.transaction, access.scope.id, page.id, page.fetch);
    const more = rows.length > page.limit;
    const items = more ? rows.slice(0, page.limit) : rows;
    const id = items.at(-1)?.id;
    const body = { items: [...items], count: items.length, ...(more && id ? { nextCursor: encodeCursor({ sort: id, id }) } : {}) };
    return { status: 200, body: body as OperationOutputFor<'risk.center.read'> };
  }
}
