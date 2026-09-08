import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { bodyRecord, textField } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { FulfillmentRepository } from '../port/FulfillmentRepository';

export class ShipmentsCreateHandler implements OperationHandler<'fulfillment.shipments.create', 'write'> {
  readonly operation = 'fulfillment.shipments.create' as const;
  readonly mode = 'write' as const;
  constructor(private readonly fulfillments: FulfillmentRepository) {}
  async execute(input: OperationInputFor<'fulfillment.shipments.create'>, context: WriteHandlerContext<'fulfillment.shipments.create'>): Promise<OperationReply<OperationOutputFor<'fulfillment.shipments.create'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    if (context.expectedVersion === undefined || !context.idempotencyKey) throw new Error('FULFILLMENT_CONCURRENCY_CONTEXT_REQUIRED');
    const lines = body.lines === undefined ? null : lineList(body.lines);
    const carrier = body.carrier === undefined ? null : textField(body, 'carrier', 128);
    const result = await this.fulfillments.ship(context.transaction, {
      id: input.path.fulfillmentid,
      scope: access.scope.id,
      actor: access.actor.id,
      trace: context.traceId,
      idempotency: context.idempotencyKey,
      expectedVersion: context.expectedVersion,
      tracking: textField(body, 'tracking', 128),
      carrier,
      lines,
    });
    return { status: 201, body: result as OperationOutputFor<'fulfillment.shipments.create'> };
  }
}

function lineList(value: unknown): readonly Readonly<{ line: string; quantity: number }>[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('FULFILLMENT_SHIPMENT_LINES_REQUIRED');
  return Object.freeze(
    value.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('FULFILLMENT_SHIPMENT_LINE_INVALID');
      const candidate = item as Record<string, unknown>;
      const quantity = Number(candidate.quantity);
      if (typeof candidate.line !== 'string' || !candidate.line || !Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('FULFILLMENT_SHIPMENT_LINE_INVALID');
      return Object.freeze({ line: candidate.line, quantity });
    })
  );
}
