import type { OperationId } from '@shop/contract';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { webBusinessRuntimeCompatibility } from '../../bootstrap/WebBusinessApiRuntime';
import type { OperationRequest, OperationResult, OperationUsecase } from '../../foundation/application/OperationHandler';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';

export const WEB_BUSINESS_RUNTIME_OPERATION_IDS = Object.freeze([
  'runtime.health.live',
  'runtime.health.ready',
  'runtime.health.startup',
] as const satisfies readonly OperationId[]);

class WebBusinessRuntimeOperations implements OperationUsecase {
  constructor(private readonly context: ModuleContext) {}

  async invoke(request: OperationRequest): Promise<OperationResult> {
    if (request.type === 'runtime.health.live') {
      return { status: 200, body: { status: 'live', profile: 'web-business-only' } };
    }
    if (request.type !== 'runtime.health.ready' && request.type !== 'runtime.health.startup') throw new Error('OPERATION_ACTION_MISSING');
    try {
      const state = await webBusinessRuntimeCompatibility(this.context.container.get(DATABASE_POOL));
      return {
        status: 200,
        body: { status: request.type === 'runtime.health.ready' ? 'ready' : 'started', profile: 'web-business-only', ...state },
      };
    } catch {
      return {
        status: 503,
        body: { status: request.type === 'runtime.health.ready' ? 'unready' : 'blocked', profile: 'web-business-only' },
      };
    }
  }
}

export function webBusinessRuntimeOperations(context: ModuleContext): OperationUsecase {
  return new WebBusinessRuntimeOperations(context);
}
