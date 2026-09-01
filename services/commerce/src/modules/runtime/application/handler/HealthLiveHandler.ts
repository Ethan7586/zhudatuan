import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';

export class HealthLiveHandler implements OperationHandler<'runtime.health.live', 'read'> {
  readonly operation = 'runtime.health.live' as const;
  readonly mode = 'read' as const;

  execute(_input: OperationInputFor<'runtime.health.live'>, _context: HandlerContext<'runtime.health.live'>): Promise<OperationReply<OperationOutputFor<'runtime.health.live'>>> {
    return Promise.resolve({ status: 200, body: { status: 'live', eventLoop: 'responsive' } });
  }
}
