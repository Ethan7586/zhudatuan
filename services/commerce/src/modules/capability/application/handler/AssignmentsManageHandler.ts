import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../platform/error/DomainError';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { bodyRecord, textField } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { ManageEntitlement } from '../service/ManageEntitlement';

export class AssignmentsManageHandler implements OperationHandler<'capability.assignments.manage', 'write'> {
  readonly operation = 'capability.assignments.manage' as const;
  readonly mode = 'write' as const;
  constructor(private readonly manage: ManageEntitlement) {}
  async execute(input: OperationInputFor<'capability.assignments.manage'>, context: WriteHandlerContext<'capability.assignments.manage'>): Promise<OperationReply<OperationOutputFor<'capability.assignments.manage'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    if (context.expectedVersion === undefined) throw new DomainError('EXPECTED_VERSION_REQUIRED');
    const changed = await this.manage.execute(context.transaction, {
      id: input.path.assignmentid,
      scope: access.scope.id,
      capability: textField(body, 'capability'),
      state: body.state === 'disabled' ? 'disabled' : 'enabled',
      quota: optionalQuota(body.quota),
      expiresAt: optionalFuture(body.expiresAt),
      expectedVersion: context.expectedVersion,
      actor: access.membership.id,
      reason: textField(body, 'reason'),
      trace: context.traceId,
      now: new Date(),
    });
    return { status: 200, body: { ...changed, dependencies: [...changed.dependencies] } };
  }
}

function optionalQuota(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new DomainError('VALIDATION_FAILED', { field: 'quota' });
  return Number(value);
}

function optionalFuture(value: unknown): Date | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new DomainError('VALIDATION_FAILED', { field: 'expiresAt' });
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new DomainError('VALIDATION_FAILED', { field: 'expiresAt' });
  return parsed;
}
