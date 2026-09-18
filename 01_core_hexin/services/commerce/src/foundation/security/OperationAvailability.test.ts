import { resolveNodeContextByHost } from '@shop/config/sfl-node-kernel';
import { describe, expect, it, vi } from 'vitest';
import { SERVER_NODE_MANIFEST_REGISTRY } from '../../bootstrap/ApiBootstrap';
import type { Actor } from './AccessContext';
import {
  NodeOperationAvailabilityResolver,
  operationFeatureRequirements,
} from './OperationAvailability';

describe('node operation availability', () => {
  it('maps shared Operations to explicit manifest features', () => {
    expect(operationFeatureRequirements('member', 'storefront')).toEqual(['identity']);
    expect(operationFeatureRequirements('catalog', 'console')).toEqual(['catalog', 'console']);
    expect(operationFeatureRequirements('order', 'storefront')).toEqual(['orders']);
    expect(operationFeatureRequirements('checkout', 'storefront')).toEqual(['checkout']);
  });

  it('requires every mapped feature declared by the server-resolved node manifest', async () => {
    const context = resolveNodeContextByHost(SERVER_NODE_MANIFEST_REGISTRY, 'api.fufuwang.com.cn');
    const resolver = new NodeOperationAvailabilityResolver();

    await expect(resolver.resolveFeature(actor(context), 'member.profile.read')).resolves.toMatchObject({
      featureDeclared: true,
      requiredFeatures: ['identity'],
    });

    const withoutIdentity = Object.freeze({
      ...context,
      manifest: Object.freeze({
        ...context.manifest,
        enabled_features: context.manifest.enabled_features.filter(({ ref }) => ref !== 'feature:identity'),
      }),
    });
    await expect(resolver.resolveFeature(actor(withoutIdentity), 'member.profile.read')).resolves.toMatchObject({
      featureDeclared: false,
      requiredFeatures: ['identity'],
    });
  });

  it('consults resource readiness for the same node and Operation', async () => {
    const context = resolveNodeContextByHost(SERVER_NODE_MANIFEST_REGISTRY, 'api.fufuwang.com.cn');
    const ready = vi.fn(async () => false);
    const resolver = new NodeOperationAvailabilityResolver({ ready });

    await expect(resolver.resourceReady(actor(context), 'member.profile.read', 'member:one')).resolves.toBe(false);
    expect(ready).toHaveBeenCalledWith(context, 'member.profile.read', 'member:one');
  });
});

function actor(nodeContext: ReturnType<typeof resolveNodeContextByHost>): Actor {
  return Object.freeze({
    id: 'actor:one',
    account: 'account:one',
    realm: nodeContext.realm.ref,
    nodeContext,
    session: 'session:one',
    membership: 'membership:one',
    credentialVersion: 1,
    accessVersion: 1,
    target: 'storefront',
    assurance: { level: 1 },
  });
}
