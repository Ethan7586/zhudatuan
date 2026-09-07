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

    const response = await bootstrapped.app.handle(new Request('https://api.zhudatuan.com/api/v1/identity/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-contract-version': CONTRACT_VERSION },
      body: '{}',
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ node: 'node:zhudatuan:l0', digest: expect.stringMatching(/^sha256:/) });
  });
});
