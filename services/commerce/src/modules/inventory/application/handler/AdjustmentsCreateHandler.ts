import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { bodyRecord, integerField, textField } from '../../../../pipeline/Validation';
import { DomainError } from '../../../../platform/error/DomainError';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { ApprovalPort } from '../../../approval/public';
import type { AdjustmentRepository } from '../port/AdjustmentRepository';

export class AdjustmentsCreateHandler implements OperationHandler<'inventory.adjustments.create', 'write'> {
  readonly operation = 'inventory.adjustments.create' as const;
  readonly mode = 'write' as const;
  constructor(
    private readonly adjustments: AdjustmentRepository,
    private readonly approvals: ApprovalPort
  ) {}
  async execute(input: OperationInputFor<'inventory.adjustments.create'>, context: WriteHandlerContext<'inventory.adjustments.create'>): Promise<OperationReply<OperationOutputFor<'inventory.adjustments.create'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const quantityDelta = body.quantityDelta;
    if (!Number.isSafeInteger(quantityDelta) || quantityDelta === 0 || Math.abs(quantityDelta as number) > 1_000_000_000) throw new DomainError('INVENTORY_QUANTITY_INVALID');
    if (!context.idempotencyKey) throw new Error('INVENTORY_ADJUSTMENT_IDEMPOTENCY_REQUIRED');
    const result = await this.adjustments.create(context.transaction, {
      scope: access.scope.id,
      requester: access.membership.id,
      stockitem: textField(body, 'stockitem'),
      quantityDelta: quantityDelta as number,
      reason: textField(body, 'reason', 1000),
      expectedVersion: integerField(body, 'expectedVersion'),
      idempotency: context.idempotencyKey,
      approvals: this.approvals,
    });
    return { status: 202, body: result as OperationOutputFor<'inventory.adjustments.create'> };
  }
}
