import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { keysetPage, queryPage } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { OrganizationReadPort } from '../../../organization/public';
import type { AssignmentRepository } from '../port/AssignmentRepository';

export class AssignmentsReadHandler implements OperationHandler<'capability.assignments.read', 'read'> {
  readonly operation = 'capability.assignments.read' as const;
  readonly mode = 'read' as const;
  constructor(
    private readonly assignments: AssignmentRepository,
    private readonly organizations: OrganizationReadPort
  ) {}
  async execute(input: OperationInputFor<'capability.assignments.read'>, context: HandlerContext<'capability.assignments.read'>): Promise<OperationReply<OperationOutputFor<'capability.assignments.read'>>> {
    const access = requireSession(context.security);
    const page = queryPage(input);
    const scope = await this.organizations.scope(context.transaction, access.scope.id);
    const rows = await this.assignments.list(context.transaction, { scope: access.scope.id, sort: page.sort, id: page.id, fetch: page.fetch, descendants: scope.descendants.length });
    const result = keysetPage(rows, page, 'name');
    return { status: 200, body: { ...result, items: [...result.items] } as OperationOutputFor<'capability.assignments.read'> };
  }
}
