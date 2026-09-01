import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { AssignmentRepository } from '../port/AssignmentRepository';
export class AssignmentsManageHandler implements OperationHandler<'capability.assignments.manage', 'write'> {
  readonly operation = 'capability.assignments.manage' as const;
  readonly mode = 'write' as const;
  constructor(private readonly assignments: AssignmentRepository) {}
  async execute(input: OperationInputFor<'capability.assignments.manage'>, context: WriteHandlerContext<'capability.assignments.manage'>): Promise<OperationReply<OperationOutputFor<'capability.assignments.manage'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const changed = await this.assignments.save(context.transaction, {
      id: input.path.assignmentid,
      scope: access.scope.id,
      capability: textField(body, 'capability'),
      state: body.state === 'disabled' ? 'disabled' : 'enabled',
      quota: typeof body.quota === 'number' ? body.quota : null,
      expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : null,
      expectedVersion: context.expectedVersion ?? null,
    });
    if (!changed) throw new DomainError('VERSION_CONFLICT');
    return { status: 200, body: changed };
  }
}
