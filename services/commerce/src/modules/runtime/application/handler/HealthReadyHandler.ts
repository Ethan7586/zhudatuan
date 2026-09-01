import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { FinalizeContext, HandlerContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ReadinessCheckpoint } from '../service/ReadinessService';
import { ReadinessService } from '../service/ReadinessService';

export class HealthReadyHandler implements DurableOperationHandler<'runtime.health.ready', null, ReadinessCheckpoint, 'read'> {
  readonly operation = 'runtime.health.ready' as const;
  readonly mode = 'read' as const;
  constructor(private readonly readiness: ReadinessService) {}
  prepare(_input: OperationInputFor<'runtime.health.ready'>, _context: PrepareContext<'runtime.health.ready'>): Promise<null> {
    return Promise.resolve(null);
  }
  async commit(_input: OperationInputFor<'runtime.health.ready'>, _prepared: null, context: HandlerContext<'runtime.health.ready'>) {
    const checkpoint = await this.readiness.checkpoint(context.transaction);
    return Object.freeze({ checkpoint, response: { status: 200, body: { status: 'unready', ...(await placeholder(checkpoint)) } } as never });
  }
  async finalize(_input: OperationInputFor<'runtime.health.ready'>, checkpoint: ReadinessCheckpoint, _context: FinalizeContext<'runtime.health.ready'>): Promise<OperationReply<OperationOutputFor<'runtime.health.ready'>>> {
    const state = await this.readiness.finalize(checkpoint);
    return { status: state.healthy ? 200 : 503, body: { status: state.healthy ? 'ready' : 'unready', ...state, degraded: [...state.degraded] } };
  }
}

async function placeholder(checkpoint: ReadinessCheckpoint): Promise<ReadinessCheckpoint> {
  return checkpoint;
}
