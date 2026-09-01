import { randomUUID } from 'node:crypto';
import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, integerField, textField } from '../../../../foundation/interface/Validation';
import { organizationScope } from '../../../../foundation/security/OrganizationScope';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { RefundRepository } from '../port/RefundRepository';

export class RefundsRequestHandler implements OperationHandler<'payment.refunds.request', 'write'> {
  readonly operation = 'payment.refunds.request' as const;
  readonly mode = 'write' as const;
  constructor(private readonly refunds: RefundRepository) {}

  async execute(input: OperationInputFor<'payment.refunds.request'>, context: WriteHandlerContext<'payment.refunds.request'>): Promise<OperationReply<OperationOutputFor<'payment.refunds.request'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const refund = await this.refunds.create(context.transaction, {
      id: `refund:${randomUUID()}`,
      payment: textField(body, 'payment'),
      amountMinor: integerField(body, 'amountMinor', 1),
      idempotency: required(context.idempotencyKey, 'IDEMPOTENCY_KEY_REQUIRED'),
      reason: textField(body, 'reason', 500),
      scope: organizationScope(access.scope),
      actor: access.actor.id,
    });
    return { status: 202, body: refund as OperationOutputFor<'payment.refunds.request'> };
  }
}

function required(value: string | undefined, code: string): string {
  if (!value) throw new Error(code);
  return value;
}
