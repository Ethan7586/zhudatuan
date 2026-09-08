import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { PaymentRepository } from '../port/PaymentRepository';

export class IntentsReadHandler implements OperationHandler<'payment.intents.read', 'read'> {
  readonly operation = 'payment.intents.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly payments: PaymentRepository) {}

  async execute(input: OperationInputFor<'payment.intents.read'>, context: HandlerContext<'payment.intents.read'>): Promise<OperationReply<OperationOutputFor<'payment.intents.read'>>> {
    const payment = input.path.paymentid;
    if (!payment) throw new DomainError('VALIDATION_FAILED', { field: 'paymentid' });
    const result = await this.payments.read(context.transaction, requireSession(context.security).membership.id, payment);
    return { status: 200, body: result as OperationOutputFor<'payment.intents.read'> };
  }
}
