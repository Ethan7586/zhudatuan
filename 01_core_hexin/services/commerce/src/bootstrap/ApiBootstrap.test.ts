import { CONTRACT_VERSION } from '@shop/contract';
import { describe, expect, it } from 'vitest';
import { requireRequestNodeContext } from '../foundation/security/AccessContext';
import { commerceTelemetry } from '../foundation/telemetry/Telemetry';
import { bootstrapApi, bindServerNodeManifestRegistry } from './ApiBootstrap';
import { ExtensionRegistry } from './ExtensionRegistry';
import type { CommerceModule } from './ModuleRegistry';

describe('API bootstrap SFL NodeContext assembly', () => {
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

    for (const origin of ['https://console.fufu.wang', 'https://console.fufuwang.com.cn']) {
      const response = await bootstrapped.app.handle(new Request('https://api.fufuwang.com.cn/api/v1/support/cases', {
        method: 'OPTIONS',
        headers: { origin, 'access-control-request-method': 'POST' },
      }));
      expect(response.status).toBe(204);
      expect(response.headers.get('access-control-allow-origin')).toBe(origin);
    }

    const denied = await bootstrapped.app.handle(new Request('https://api.fufuwang.com.cn/api/v1/support/cases', {
      method: 'OPTIONS',
      headers: { origin: 'https://console.example.com', 'access-control-request-method': 'POST' },
    }));
    expect(denied.status).toBe(403);
    await expect(denied.json()).resolves.toMatchObject({ code: 'ORIGIN_DENIED' });
  });
});
