import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { keysetPage, queryPage } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { AssignmentRepository } from '../port/AssignmentRepository';
export class AssignmentsReadHandler implements OperationHandler<'capability.assignments.read', 'read'> {
  readonly operation = 'capability.assignments.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly assignments: AssignmentRepository) {}
  async execute(input: OperationInputFor<'capability.assignments.read'>, context: HandlerContext<'capability.assignments.read'>): Promise<OperationReply<OperationOutputFor<'capability.assignments.read'>>> {
    const access = requireSession(context.security);
    const page = queryPage(input);
    const rows = await this.assignments.list(context.transaction, { scope: access.scope.id, sort: page.sort, id: page.id, fetch: page.fetch });
    const result = keysetPage(rows, page, 'name');
    return { status: 200, body: { ...result, items: [...result.items] } as OperationOutputFor<'capability.assignments.read'> };
  }
}
