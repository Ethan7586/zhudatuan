import { CONTRACT_VERSION } from '@shop/contract';
import { ArchBoard } from '@shop/l-kernel/arch';
import { describe, expect, it } from 'vitest';
import { requireRequestNodeContext } from '../foundation/security/AccessContext';
import { commerceTelemetry } from '../foundation/telemetry/Telemetry';
import { bootstrapApi, bindServerNodeManifestRegistry } from './ApiBootstrap';
import { ExtensionRegistry } from './ExtensionRegistry';
import type { CommerceModule } from './ModuleRegistry';

describe('API bootstrap SFL NodeContext assembly', () => {
  it('keeps runtime health outside Arch', async () => {
    let called = 0;
    const module: CommerceModule = {
      id: 'arch-health-install-test', dependencies: [],
      register({ routes }) {
        routes.register({ operation: 'runtime.health.ready', handler: async () => {
          called += 1;
          return { status: 200, body: { status: 'ready' } };
        } });
      },
    };
    const bootstrapped = await bootstrapApi({
      modules: [module],
      extensions: new ExtensionRegistry({ verify: async () => true } as never),
      allowedOrigins: [], telemetry: commerceTelemetry(),
      operationIds: ['runtime.health.ready'],
    });
    const request = () => bootstrapped.app.handle(new Request('http://127.0.0.1/health/ready'));
    expect(bootstrapped.arch.state('unresolved', 'runtime.health.ready')).toBe('unmounted');
    expect((await request()).status).toBe(200);
    expect(called).toBe(1);
    expect((await request()).status).toBe(200);
    expect(called).toBe(2);
  });

  it('keeps a single-node runtime from resolving another node through the shared registry', async () => {
    const bootstrapped = await bootstrapApi({
      modules: [],
      extensions: new ExtensionRegistry({ verify: async () => true } as never),
      configure: bindServerNodeManifestRegistry,
      allowedOrigins: [], telemetry: commerceTelemetry(),
      operationIds: [], runtimeNodeIds: ['node:hbbtzn:l1'],
    });
    expect(bootstrapped.nodeContextResolver?.resolve('accounts.hbbtzn.com').node_id).toBe('node:hbbtzn:l1');
    expect(() => bootstrapped.nodeContextResolver?.resolve('api.fufu.wang'))
      .toThrow('SFL_NODE_MANIFEST_HOST_RUNTIME_MISMATCH');
    expect(bootstrapped.arch.state('node:zhudatuan:l0', 'member.profile.read')).toBe('unmounted');
  });

  it('installs registered routes on Arch for each node without changing their owner', async () => {
    const received: string[] = [];
    const module: CommerceModule = {
      id: 'arch-member-install-test', dependencies: [],
      register({ routes }) {
        routes.register({ operation: 'member.storefront.config.read', handler: async (request) => {
          const node = requireRequestNodeContext(request.headers).node_id;
          received.push(node);
          return { status: 200, body: { node, owner: 'member' } };
        } });
      },
    };
    const bootstrapped = await bootstrapApi({
      modules: [module],
      extensions: new ExtensionRegistry({ verify: async () => true } as never),
      configure: bindServerNodeManifestRegistry, allowedOrigins: [], telemetry: commerceTelemetry(),
      operationIds: ['member.storefront.config.read'],
    });
    const send = (host: string) => bootstrapped.app.handle(new Request(`https://${host}/api/v1/member/storefront-profile-config`));
    expect(bootstrapped.arch.state('node:hbbtzn:l1', 'member.storefront.config.read')).toBe('connected');
    expect(bootstrapped.arch.state('node:zhudatuan:l0', 'member.storefront.config.read')).toBe('connected');
    expect(bootstrapped.arch.state('node:hbbtzn:l1', 'identity.sessions.create')).toBe('unmounted');
    const first = await send('accounts.hbbtzn.com');
    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toMatchObject({ node: 'node:hbbtzn:l1', owner: 'member' });
    bootstrapped.arch.setConnected('node:hbbtzn:l1', 'member.storefront.config.read', false);
    expect((await send('accounts.hbbtzn.com')).status).toBe(404);
    const l0 = await send('api.fufu.wang');
    expect(l0.status).toBe(200);
    await expect(l0.json()).resolves.toMatchObject({ node: 'node:zhudatuan:l0', owner: 'member' });
    bootstrapped.arch.setConnected('node:hbbtzn:l1', 'member.storefront.config.read', true);
    expect((await send('accounts.hbbtzn.com')).status).toBe(200);
    expect(received).toEqual(['node:hbbtzn:l1', 'node:zhudatuan:l0', 'node:hbbtzn:l1']);

    bootstrapped.arch.unmount('node:hbbtzn:l1', 'member.storefront.config.read');
    expect(bootstrapped.arch.state('node:hbbtzn:l1', 'member.storefront.config.read')).toBe('removed');
    expect((await send('accounts.hbbtzn.com')).status).toBe(404);
    expect((await send('api.fufu.wang')).status).toBe(200);
    bootstrapped.arch.mountAll(['node:hbbtzn:l1'], ['member.storefront.config.read']);
    expect((await send('accounts.hbbtzn.com')).status).toBe(404);
    bootstrapped.arch.mount('node:hbbtzn:l1', 'member.storefront.config.read');
    expect((await send('accounts.hbbtzn.com')).status).toBe(200);
  });

  it('routes an existing identity HTTP interface through Arch without mixing L1 nodes', async () => {
    const arch = new ArchBoard();
    const received: unknown[] = [];
    const module: CommerceModule = {
      id: 'arch-identity-route-test', dependencies: [],
      register({ routes }) {
        routes.register({ operation: 'identity.sessions.create', handler: async (request) => {
          received.push(request.body);
          return { status: 200, body: { node: requireRequestNodeContext(request.headers).node_id, data: request.body } };
        } });
        routes.register({ operation: 'member.storefront.config.read', handler: async () => ({
          status: 200, body: { owner: 'member', unchanged: true },
        }) });
      },
    };
    const bootstrapped = await bootstrapApi({
      modules: [module], arch, extensions: new ExtensionRegistry({ verify: async () => true } as never),
      configure: bindServerNodeManifestRegistry, allowedOrigins: [], telemetry: commerceTelemetry(),
      operationIds: ['identity.sessions.create', 'member.storefront.config.read'],
    });
    const send = (host: string, value: string) => bootstrapped.app.handle(new Request(`https://${host}/api/v1/identity/sessions`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-contract-version': CONTRACT_VERSION },
      body: JSON.stringify({ value }),
    }));

    const original = await send('accounts.hbbtzn.com', 'before');
    expect(original.status).toBe(200);
    await expect(original.json()).resolves.toMatchObject({ node: 'node:hbbtzn:l1', data: { value: 'before' } });
    expect(bootstrapped.arch.state('node:hbbtzn:l1', 'identity.sessions.create')).toBe('connected');
    arch.setConnected('node:hbbtzn:l1', 'identity.sessions.create', false);
    const disconnected = await send('accounts.hbbtzn.com', 'blocked');
    expect(disconnected.status).toBe(404);
    const member = await bootstrapped.app.handle(new Request('https://accounts.hbbtzn.com/api/v1/member/storefront-profile-config'));
    expect(member.status).toBe(200);
    await expect(member.json()).resolves.toMatchObject({ owner: 'member', unchanged: true });
    expect(bootstrapped.arch.state('node:hbbtzn:l1', 'member.storefront.config.read')).toBe('connected');
    expect(bootstrapped.arch.state('node:zhudatuan:l0', 'identity.sessions.create')).toBe('connected');
    const otherNode = await send('accounts.fufu.wang', 'other');
    expect(otherNode.status).toBe(200);
    await expect(otherNode.json()).resolves.toMatchObject({ data: { value: 'other' } });
    arch.setConnected('node:hbbtzn:l1', 'identity.sessions.create', true);
    const restored = await send('accounts.hbbtzn.com', 'after');
    expect(restored.status).toBe(200);
    await expect(restored.json()).resolves.toMatchObject({ node: 'node:hbbtzn:l1', data: { value: 'after' } });
    expect(received).toEqual([{ value: 'before' }, { value: 'other' }, { value: 'after' }]);
  });

  it('installs the shared verified registry for a real API request', async () => {
    const module: CommerceModule = {
      id: 'node-context-test',
      dependencies: [],
      register({ routes }) {
        routes.register({
          operation: 'identity.sessions.create',
          handler: async (request) => {
            const nodeContext = requireRequestNodeContext(request.headers);
            return { status: 200, body: { node: nodeContext.node_id, digest: nodeContext.manifest_digest } };
          },
        });
      },
    };
    const bootstrapped = await bootstrapApi({
      modules: [module],
      extensions: new ExtensionRegistry({ verify: async () => true } as never),
      configure: bindServerNodeManifestRegistry,
      allowedOrigins: [],
      telemetry: commerceTelemetry(),
      operationIds: ['identity.sessions.create'],
    });

    const response = await bootstrapped.app.handle(new Request('https://api.fufu.wang/api/v1/identity/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-contract-version': CONTRACT_VERSION },
      body: '{}',
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ node: 'node:zhudatuan:l0', digest: expect.stringMatching(/^sha256:/) });
  });

  it('allows every registered Console surface only when the shared runtime declares that surface', async () => {
    const bootstrapped = await bootstrapApi({
      modules: [],
      extensions: new ExtensionRegistry({ verify: async () => true } as never),
      configure: bindServerNodeManifestRegistry,
      allowedOrigins: ['https://console.zhudatuan.com'],
      allowedOriginSurfaces: ['surface:console'],
      telemetry: commerceTelemetry(),
      operationIds: [],
    });

    for (const origin of ['https://console.fufu.wang', 'https://console.hbbtzn.com']) {
      const response = await bootstrapped.app.handle(new Request('https://api.hbbtzn.com/api/v1/support/cases', {
        method: 'OPTIONS',
        headers: { origin, 'access-control-request-method': 'POST' },
      }));
      expect(response.status).toBe(204);
      expect(response.headers.get('access-control-allow-origin')).toBe(origin);
    }

    const denied = await bootstrapped.app.handle(new Request('https://api.hbbtzn.com/api/v1/support/cases', {
      method: 'OPTIONS',
      headers: { origin: 'https://console.example.com', 'access-control-request-method': 'POST' },
    }));
    expect(denied.status).toBe(403);
    await expect(denied.json()).resolves.toMatchObject({ code: 'ORIGIN_DENIED' });
  });
});
