import type { OperationId } from '@shop/contract';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import type { OperationRequest, OperationResult, OperationUsecase } from '../../foundation/application/OperationHandler';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { identityRegistrationRuntimeCompatibility } from '../../bootstrap/IdentityRegistrationApiRuntime';

export const IDENTITY_REGISTRATION_RUNTIME_OPERATION_IDS = Object.freeze([
  'runtime.health.live',
  'runtime.health.ready',
  'runtime.health.startup',
] as const satisfies readonly OperationId[]);

class IdentityRegistrationRuntimeOperations implements OperationUsecase {
  constructor(private readonly context: ModuleContext) {}

  async invoke(request: OperationRequest): Promise<OperationResult> {
    if (request.type === 'runtime.health.live') return { status: 200, body: { status: 'live', profile: 'registration-only' } };
    if (request.type !== 'runtime.health.ready' && request.type !== 'runtime.health.startup') throw new Error('OPERATION_ACTION_MISSING');
    try {
      const state = await identityRegistrationRuntimeCompatibility(this.context.container.get(DATABASE_POOL));
      return { status: 200, body: { status: request.type === 'runtime.health.ready' ? 'ready' : 'started', ...state } };
    } catch {
      return { status: 503, body: { status: request.type === 'runtime.health.ready' ? 'unready' : 'blocked', profile: 'registration-only' } };
    }
  }
}

export function identityRegistrationRuntimeOperations(context: ModuleContext): OperationUsecase {
  return new IdentityRegistrationRuntimeOperations(context);
}
