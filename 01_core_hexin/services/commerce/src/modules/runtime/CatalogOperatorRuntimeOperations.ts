import type { OperationId } from '@shop/contract';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { catalogOperatorRuntimeCompatibility } from '../../bootstrap/CatalogOperatorApiRuntime';
import { NODE_DATABASE_ROLE, NODE_MANIFEST } from '../../bootstrap/NodeRuntime';
import type { OperationRequest, OperationResult, OperationUsecase } from '../../foundation/application/OperationHandler';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';

export const CATALOG_OPERATOR_RUNTIME_OPERATION_IDS = Object.freeze([
  'runtime.health.live',
  'runtime.health.ready',
  'runtime.health.startup',
] as const satisfies readonly OperationId[]);

class CatalogOperatorRuntimeOperations implements OperationUsecase {
  constructor(private readonly context: ModuleContext) {}

  async invoke(request: OperationRequest): Promise<OperationResult> {
    const manifest = this.context.container.get(NODE_MANIFEST);
    const evidence = {
      profile: 'catalog-operator-only',
      manifestId: manifest.manifest_id,
      manifestVersion: manifest.manifest_version,
      manifestDigest: manifest.manifest_digest,
      runtimeInstanceId: manifest.runtime_instance_id,
      resourceBindingVersion: manifest.resource_binding_set_ref.version,
      nodeId: manifest.node_id,
      scopeId: manifest.data_scope_ref.ref,
    };
    if (request.type === 'runtime.health.live') return { status: 200, body: { status: 'live', ...evidence } };
    if (request.type !== 'runtime.health.ready' && request.type !== 'runtime.health.startup') throw new Error('OPERATION_ACTION_MISSING');
    try {
      const state = await catalogOperatorRuntimeCompatibility(
        this.context.container.get(DATABASE_POOL),
        this.context.container.get(NODE_DATABASE_ROLE),
      );
      return { status: 200, body: { status: request.type === 'runtime.health.ready' ? 'ready' : 'started', ...evidence, ...state } };
    } catch {
      return { status: 503, body: { status: request.type === 'runtime.health.ready' ? 'unready' : 'blocked', ...evidence } };
    }
  }
}

export function catalogOperatorRuntimeOperations(context: ModuleContext): OperationUsecase {
  return new CatalogOperatorRuntimeOperations(context);
}
