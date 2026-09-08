import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { bodyRecord, optionalText, textField } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { FulfillmentAction } from '../../domain/model/FulfillmentState';
import type { StoreWorkRepository } from '../port/StoreWorkRepository';

const ACTIONS = Object.freeze({ accept: 'accept', prepare: 'progress', ready: 'ready', complete: 'complete' } as const satisfies Readonly<Record<string, FulfillmentAction>>);

export class WorkitemsTransitionHandler implements OperationHandler<'fulfillment.workitems.transition', 'write'> {
  readonly operation = 'fulfillment.workitems.transition' as const;
  readonly mode = 'write' as const;
  constructor(private readonly work: StoreWorkRepository) {}
  async execute(input: OperationInputFor<'fulfillment.workitems.transition'>, context: WriteHandlerContext<'fulfillment.workitems.transition'>): Promise<OperationReply<OperationOutputFor<'fulfillment.workitems.transition'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const selected = Reflect.get(ACTIONS, textField(body, 'action', 20)) as (typeof ACTIONS)[keyof typeof ACTIONS] | undefined;
    if (selected === undefined || context.expectedVersion === undefined || !context.idempotencyKey) throw new Error('FULFILLMENT_WORK_TRANSITION_INVALID');
    const result = await this.work.transition(context.transaction, {
      id: input.path.fulfillmentid,
      scope: access.scope.id,
      actor: access.membership.id,
      trace: context.traceId,
      idempotency: context.idempotencyKey,
      expectedVersion: context.expectedVersion,
      action: selected,
      note: optionalText(body, 'note', 1000),
    });
    return { status: 200, body: result as OperationOutputFor<'fulfillment.workitems.transition'> };
  }
}
