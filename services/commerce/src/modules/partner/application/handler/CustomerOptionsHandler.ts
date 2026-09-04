import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { limit, queryText } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { CustomerRepository } from '../port/CustomerRepository';

export class CustomerOptionsHandler implements OperationHandler<'partner.customeroptions.list', 'read'> {
  readonly operation = 'partner.customeroptions.list' as const;
  readonly mode = 'read' as const;
  constructor(private readonly customers: CustomerRepository) {}
  async execute(input: OperationInputFor<'partner.customeroptions.list'>, context: HandlerContext<'partner.customeroptions.list'>): Promise<OperationReply<OperationOutputFor<'partner.customeroptions.list'>>> {
    const access = requireSession(context.security);
    const items = await this.customers.options(context.transaction, { scope: access.scope.id, q: queryText(input, 'q', 160), limit: limit(input, 50) });
    return { status: 200, body: { items: [...items], count: items.length } as OperationOutputFor<'partner.customeroptions.list'> };
  }
}
