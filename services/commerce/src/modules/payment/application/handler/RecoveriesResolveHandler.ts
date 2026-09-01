import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { organizationScope } from '../../../../foundation/security/OrganizationScope';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { RecoveryAction, RecoveryRepository } from '../port/RecoveryRepository';

const actions = new Set<RecoveryAction>(['replay', 'requery', 'retryrefund', 'resolve']);

export class RecoveriesResolveHandler implements OperationHandler<'payment.recoveries.resolve', 'write'> {
  readonly operation = 'payment.recoveries.resolve' as const;
  readonly mode = 'write' as const;
  constructor(private readonly recoveries: RecoveryRepository) {}

  async execute(input: OperationInputFor<'payment.recoveries.resolve'>, context: WriteHandlerContext<'payment.recoveries.resolve'>): Promise<OperationReply<OperationOutputFor<'payment.recoveries.resolve'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const action = textField(body, 'action', 32) as RecoveryAction;
    if (!actions.has(action)) throw new Error('PAYMENT_RECOVERY_ACTION_INVALID');
    const result = await this.recoveries.resolve(context.transaction, {
      case: required(input.path.caseid, 'PAYMENT_RECOVERY_CASE_REQUIRED'),
      action,
      reason: textField(body, 'reason', 500),
      scope: organizationScope(access.scope),
      actor: access.actor.id,
      membership: access.membership.id,
      trace: access.trace,
      idempotency: required(context.idempotencyKey, 'IDEMPOTENCY_KEY_REQUIRED'),
    });
    return { status: 202, body: result as OperationOutputFor<'payment.recoveries.resolve'> };
  }
}

function required(value: string | undefined, code: string): string {
  if (!value) throw new Error(code);
  return value;
}
