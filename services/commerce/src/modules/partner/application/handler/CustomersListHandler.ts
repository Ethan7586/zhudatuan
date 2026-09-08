import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { keysetPage, queryPage, queryText } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { CustomerKind, CustomerState } from '../../domain/model/Customer';
import type { CustomerRepository } from '../port/CustomerRepository';

export class CustomersListHandler implements OperationHandler<'partner.customers.list', 'read'> {
  readonly operation = 'partner.customers.list' as const;
  readonly mode = 'read' as const;

  constructor(private readonly customers: CustomerRepository) {}

  async execute(input: OperationInputFor<'partner.customers.list'>, context: HandlerContext<'partner.customers.list'>): Promise<OperationReply<OperationOutputFor<'partner.customers.list'>>> {
    const access = requireSession(context.security);
    const page = queryPage(input);
    const rows = await this.customers.list(context.transaction, {
      scope: access.scope.id,
      q: queryText(input, 'q', 160),
      kind: optionalKind(input.query?.kind),
      status: optionalState(input.query?.status),
      sort: page.sort,
      id: page.id,
      fetch: page.fetch,
    });
    return { status: 200, body: keysetPage(rows, page, 'updatedAt') as OperationOutputFor<'partner.customers.list'> };
  }
}

function optionalKind(value: unknown): CustomerKind | null {
  return value === 'enterprise' || value === 'institution' || value === 'government' ? value : null;
}

function optionalState(value: unknown): CustomerState | null {
  return value === 'draft' || value === 'active' || value === 'disabled' ? value : null;
}
