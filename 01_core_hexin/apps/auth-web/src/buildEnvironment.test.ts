import { describe, expect, it } from 'vitest';
import { PRODUCTION_IDENTITY_NODE_REGISTRY_SOURCE } from '@shop/sdk/identity-node';
import { validateAuthBuildEnvironment } from './buildEnvironment';

const production = Object.freeze({
  VITE_IDENTITY_NODE_REGISTRY: PRODUCTION_IDENTITY_NODE_REGISTRY_SOURCE,
  VITE_CLIENT_VERSION: '1.0.0',
});

describe('auth production build environment', () => {
  it('requires every browser runtime value at build time', () => {
    expect(validateAuthBuildEnvironment(production)).toEqual({
      identityNodes: expect.objectContaining({ version: 2, nodes: expect.any(Array) }),
      identityNodeRegistrySource: PRODUCTION_IDENTITY_NODE_REGISTRY_SOURCE,
      clientVersion: '1.0.0',
    });
    expect(validateAuthBuildEnvironment({ VITE_CLIENT_VERSION: '1.0.0' }).identityNodeRegistrySource)
      .toBe(PRODUCTION_IDENTITY_NODE_REGISTRY_SOURCE);
    expect(() => validateAuthBuildEnvironment({ ...production, VITE_CLIENT_VERSION: undefined })).toThrow(/_MISSING$/);
  });

  it('rejects a client version that the runtime contract cannot send', () => {
    expect(() => validateAuthBuildEnvironment({ ...production, VITE_CLIENT_VERSION: 'ca046ae' }))
      .toThrow('AUTH_CLIENT_VERSION_INVALID');
  });

  it('rejects local origins in a production build registry', () => {
    const registry = JSON.parse(production.VITE_IDENTITY_NODE_REGISTRY);
    registry.nodes[0].apiOrigin = 'http://127.0.0.1:3001';
    expect(() => validateAuthBuildEnvironment({
      ...production, VITE_IDENTITY_NODE_REGISTRY: JSON.stringify(registry),
    })).toThrow('AUTH_CLIENT_IDENTITY_NODE_ORIGIN_INVALID');
  });

  it('rejects a valid but non-canonical production registry', () => {
    const registry = JSON.parse(production.VITE_IDENTITY_NODE_REGISTRY);
    registry.nodes[0].displayName = '漂移节点';
    expect(() => validateAuthBuildEnvironment({
      ...production, VITE_IDENTITY_NODE_REGISTRY: JSON.stringify(registry),
    })).toThrow('AUTH_CLIENT_IDENTITY_NODE_MANIFEST_DRIFT');
  });
});
