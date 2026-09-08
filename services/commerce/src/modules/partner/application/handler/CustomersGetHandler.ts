import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../platform/error/DomainError';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { CustomerRepository } from '../port/CustomerRepository';

export class CustomersGetHandler implements OperationHandler<'partner.customers.get', 'read'> {
  readonly operation = 'partner.customers.get' as const;
  readonly mode = 'read' as const;

  constructor(private readonly customers: CustomerRepository) {}

  async execute(input: OperationInputFor<'partner.customers.get'>, context: HandlerContext<'partner.customers.get'>): Promise<OperationReply<OperationOutputFor<'partner.customers.get'>>> {
    const access = requireSession(context.security);
    const customer = await this.customers.get(context.transaction, access.scope.id, input.path.customerid);
    if (!customer) throw new DomainError('RESOURCE_NOT_FOUND');
    return { status: 200, body: customer as OperationOutputFor<'partner.customers.get'>, headers: { etag: `"${customer.version}"` } };
  }
}
