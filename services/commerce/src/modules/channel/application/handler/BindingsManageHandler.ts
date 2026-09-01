import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { DistributorRepository } from '../port/DistributorRepository';

const states = new Set(['draft', 'active', 'expired', 'terminated']);

export class BindingsManageHandler implements OperationHandler<'channel.bindings.manage', 'write'> {
  readonly operation = 'channel.bindings.manage' as const;
  readonly mode = 'write' as const;
  constructor(private readonly distributors: DistributorRepository) {}
  async execute(input: OperationInputFor<'channel.bindings.manage'>, context: WriteHandlerContext<'channel.bindings.manage'>): Promise<OperationReply<OperationOutputFor<'channel.bindings.manage'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const state = textField(body, 'state', 64);
    if (!states.has(state)) throw new Error('STATE_INVALID');
    const result = await this.distributors.manageBinding(context.transaction, {
      id: input.path.bindingid,
      root: access.scope.id,
      distributor: textField(body, 'distributor'),
      tenant: textField(body, 'tenant'),
      state,
      evidence: record(body.evidence),
      effectiveAt: body.effectiveAt ?? null,
      expiresAt: body.expiresAt ?? null,
      expectedVersion: context.expectedVersion ?? null,
    });
    return { status: 200, body: result as OperationOutputFor<'channel.bindings.manage'> };
  }
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (value === undefined || value === null) return Object.freeze({});
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('JSON_OBJECT_REQUIRED');
  return Object.freeze({ ...(value as Record<string, unknown>) });
}
