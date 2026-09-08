import type { OperationId } from '@shop/contract';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { purchaseRuntimeCompatibility } from '../../bootstrap/PurchaseApiRuntime';
import type { OperationRequest, OperationResult, OperationUsecase } from '../../foundation/application/OperationHandler';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { NODE_DATABASE_ROLE, NODE_MANIFEST } from '../../bootstrap/NodeRuntime';

export const PURCHASE_RUNTIME_OPERATION_IDS = Object.freeze([
  'runtime.health.live',
  'runtime.health.ready',
  'runtime.health.startup',
] as const satisfies readonly OperationId[]);

class PurchaseRuntimeOperations implements OperationUsecase {
  constructor(private readonly context: ModuleContext) {}

  async invoke(request: OperationRequest): Promise<OperationResult> {
    const manifest = this.context.container.get(NODE_MANIFEST);
    const node = { nodeId: manifest.node_id, manifestId: manifest.manifest_id, manifestDigest: manifest.manifest_digest };
    if (request.type === 'runtime.health.live') return { status: 200, body: { status: 'live', profile: 'purchase-only', ...node } };
    if (request.type !== 'runtime.health.ready' && request.type !== 'runtime.health.startup') throw new Error('OPERATION_ACTION_MISSING');
    try {
      const state = await purchaseRuntimeCompatibility(
        this.context.container.get(DATABASE_POOL), this.context.container.get(NODE_DATABASE_ROLE));
      return { status: 200, body: { status: request.type === 'runtime.health.ready' ? 'ready' : 'started', profile: 'purchase-only', ...node, ...state } };
    } catch {
      return { status: 503, body: { status: request.type === 'runtime.health.ready' ? 'unready' : 'blocked', profile: 'purchase-only', ...node } };
    }
  }
}

export function purchaseRuntimeOperations(context: ModuleContext): OperationUsecase {
  return new PurchaseRuntimeOperations(context);
}
