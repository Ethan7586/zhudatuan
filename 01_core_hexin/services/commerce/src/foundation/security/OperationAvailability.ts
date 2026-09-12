import { OperationCatalog } from '@shop/contract';
import { nodeManifestHasFeature } from '@shop/config/server';
import type { ResolvedNodeContext } from '@shop/config/sfl-node-kernel';
import { requireActorNodeContext, type Actor } from './AccessContext';

export interface OperationFeatureAvailability {
  readonly featureDeclared: boolean;
  readonly requiredFeatures: readonly string[];
}

export interface OperationAvailabilityResolver {
  resolveFeature(actor: Actor, operation: string): Promise<OperationFeatureAvailability>;
  resourceReady(actor: Actor, operation: string, resource?: string): Promise<boolean>;
}

export interface OperationResourceReadiness {
  ready(context: ResolvedNodeContext, operation: string, resource?: string): Promise<boolean>;
}

const READY_MANIFEST_RESOURCES: OperationResourceReadiness = Object.freeze({
  async ready(context: ResolvedNodeContext): Promise<boolean> {
    const manifest = context.manifest;
    return manifest.lifecycle_status === 'active'
      && manifest.resource_binding_set_ref.ref.length > 0
      && manifest.runtime_config_ref.ref.length > 0
      && manifest.release_pointer_ref.ref.length > 0;
  },
});

const FEATURE_MODULES = Object.freeze({
  identity: new Set(['identity', 'member', 'verification', 'referral', 'benefit']),
  catalog: new Set(['catalog', 'inventory', 'pricing', 'marketing', 'experience', 'channel', 'partner', 'qualification']),
  checkout: new Set(['cart', 'checkout', 'payment', 'voucher']),
  orders: new Set(['order', 'fulfillment']),
});

export class NodeOperationAvailabilityResolver implements OperationAvailabilityResolver {
  constructor(private readonly resources: OperationResourceReadiness = READY_MANIFEST_RESOURCES) {}

  async resolveFeature(actor: Actor, operation: string): Promise<OperationFeatureAvailability> {
    const context = requireActorNodeContext(actor);
    const definition = OperationCatalog.get(operation);
    const requiredFeatures = operationFeatureRequirements(definition.module, actor.target);
    const featureDeclared = requiredFeatures.every((feature) => nodeManifestHasFeature(context.manifest, feature));
    return Object.freeze({ featureDeclared, requiredFeatures });
  }

  async resourceReady(actor: Actor, operation: string, resource?: string): Promise<boolean> {
    return await this.resources.ready(requireActorNodeContext(actor), operation, resource);
  }
}

export function operationFeatureRequirements(module: string, target: Actor['target']): readonly string[] {
  if (module === 'runtime') return Object.freeze([]);
  const features = new Set<string>();
  for (const [feature, modules] of Object.entries(FEATURE_MODULES)) {
    if (modules.has(module)) features.add(feature);
  }
  if (target === 'console' || features.size === 0) features.add(target === 'console' ? 'console' : 'identity');
  return Object.freeze([...features]);
}
