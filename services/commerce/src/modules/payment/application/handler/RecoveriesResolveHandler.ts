import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { bodyRecord, textField } from '../../../../pipeline/Validation';
import { organizationScope } from '../../../../platform/security/OrganizationScope';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { RecoveryAction, RecoveryRepository } from '../port/RecoveryRepository';
import { DomainError } from '../../../../platform/error/DomainError';

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
      case: required(input.path.caseid, 'caseid'),
      action,
      reason: textField(body, 'reason', 500),
      scope: organizationScope(access.scope),
      actor: access.actor.id,
      membership: access.membership.id,
      trace: access.trace,
      idempotency: required(context.idempotencyKey, 'idempotency'),
      expectedVersion: requiredVersion(context.expectedVersion),
    });
    return { status: 202, body: result as OperationOutputFor<'payment.recoveries.resolve'> };
  }
}

function requiredVersion(value: number | undefined): number {
  if (!Number.isSafeInteger(value) || value! < 0) throw new DomainError('EXPECTED_VERSION_REQUIRED');
  return value!;
}

function required(value: string | undefined, field: string): string {
  if (!value) {
    if (field === 'idempotency') throw new DomainError('IDEMPOTENCY_KEY_REQUIRED');
    throw new DomainError('VALIDATION_FAILED', { field });
  }
  return value;
}
