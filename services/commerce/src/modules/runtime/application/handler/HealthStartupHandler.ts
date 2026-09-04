import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { FinalizeContext, HandlerContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ReadinessCheckpoint } from '../service/EvaluateReadiness';
import { EvaluateReadiness } from '../service/EvaluateReadiness';

export class HealthStartupHandler implements DurableOperationHandler<'runtime.health.startup', null, ReadinessCheckpoint, 'read'> {
  readonly operation = 'runtime.health.startup' as const;
  readonly mode = 'read' as const;
  constructor(private readonly readiness: EvaluateReadiness) {}
  prepare(_input: OperationInputFor<'runtime.health.startup'>, _context: PrepareContext<'runtime.health.startup'>): Promise<null> {
    return Promise.resolve(null);
  }
  async commit(_input: OperationInputFor<'runtime.health.startup'>, _prepared: null, context: HandlerContext<'runtime.health.startup'>) {
    const checkpoint = await this.readiness.checkpoint(context.transaction);
    return Object.freeze({ checkpoint, response: { status: 200, body: checkpoint } as never });
  }
  async finalize(_input: OperationInputFor<'runtime.health.startup'>, checkpoint: ReadinessCheckpoint, _context: FinalizeContext<'runtime.health.startup'>): Promise<OperationReply<OperationOutputFor<'runtime.health.startup'>>> {
    const state = await this.readiness.finalize(checkpoint);
    return { status: state.healthy ? 200 : 503, body: { status: state.healthy ? 'started' : 'blocked', ...state, degraded: [...state.degraded] } };
  }
}
