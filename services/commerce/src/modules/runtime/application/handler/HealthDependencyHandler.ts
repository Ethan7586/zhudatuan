import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { FinalizeContext, HandlerContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { Cache } from '../../../../foundation/cache/Cache';
import type { QueryMetrics } from '../../../../foundation/persistence/QueryMetrics';
import type { RuntimeQueueState, RuntimeRepository } from '../port/RuntimeRepository';
import type { ReadinessCheckpoint } from '../service/ReadinessService';
import { ReadinessService } from '../service/ReadinessService';

interface DependencyCheckpoint {
  readonly readiness: ReadinessCheckpoint;
  readonly queue: RuntimeQueueState;
}

export class HealthDependencyHandler implements DurableOperationHandler<'runtime.health.dependency', null, DependencyCheckpoint, 'read'> {
  readonly operation = 'runtime.health.dependency' as const;
  readonly mode = 'read' as const;
  constructor(
    private readonly runtime: RuntimeRepository,
    private readonly readiness: ReadinessService,
    private readonly cache: Cache,
    private readonly metrics: QueryMetrics
  ) {}
  prepare(_input: OperationInputFor<'runtime.health.dependency'>, _context: PrepareContext<'runtime.health.dependency'>): Promise<null> {
    return Promise.resolve(null);
  }
  async commit(_input: OperationInputFor<'runtime.health.dependency'>, _prepared: null, context: HandlerContext<'runtime.health.dependency'>) {
    const readiness = await this.readiness.checkpoint(context.transaction);
    const queue = await this.runtime.queueState(context.transaction);
    return Object.freeze({ checkpoint: Object.freeze({ readiness, queue }), response: { status: 200, body: { readiness, queue } } as never });
  }
  async finalize(_input: OperationInputFor<'runtime.health.dependency'>, checkpoint: DependencyCheckpoint, _context: FinalizeContext<'runtime.health.dependency'>): Promise<OperationReply<OperationOutputFor<'runtime.health.dependency'>>> {
    const readiness = await this.readiness.finalize(checkpoint.readiness);
    return {
      status: readiness.healthy ? 200 : 503,
      body: { status: readiness.healthy ? 'available' : 'degraded', queue: checkpoint.queue, cache: this.cache.state(), databaseQueries: [...this.metrics.snapshot()], readiness: { ...readiness, degraded: [...readiness.degraded] } },
    };
  }
}
