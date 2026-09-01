import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ReadNavigationHealth } from '../service/ReadNavigationHealth';

export class HealthReadHandler implements OperationHandler<'navigation.health.read', 'read'> {
  readonly operation = 'navigation.health.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly health: ReadNavigationHealth) {}

  execute(_input: OperationInputFor<'navigation.health.read'>, context: HandlerContext<'navigation.health.read'>): Promise<OperationReply<OperationOutputFor<'navigation.health.read'>>> {
    context.signal.throwIfAborted();
    return Promise.resolve(this.health.execute() as OperationReply<OperationOutputFor<'navigation.health.read'>>);
  }
}
