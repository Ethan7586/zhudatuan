import { request as httpRequest } from 'node:http';
import { CONTRACT_VERSION } from '@shop/contract';
import { resolveNodeContextByHost, type NodeContextResolver, type ResolvedNodeContext } from '@shop/config/sfl-node-kernel';
import { describe, expect, it } from 'vitest';
import { bootstrapApi, bindServerNodeManifestRegistry, SERVER_NODE_MANIFEST_REGISTRY } from '../../bootstrap/ApiBootstrap';
import { ExtensionRegistry } from '../../bootstrap/ExtensionRegistry';
import type { RouteRegistry } from '../../bootstrap/RouteRegistry';
import { requireRequestNodeContext } from '../security/AccessContext';
import { commerceTelemetry } from '../telemetry/Telemetry';
import { HttpApp } from './HttpApp';
import { listen, trustedPeerAddress } from './NodeServer';

describe('NodeServer NodeContext ingress', () => {
  it('resolves once before an outer handler and shares the exact context with HttpApp', async () => {
    let resolveCount = 0;
    let ingress: ResolvedNodeContext | undefined;
    let observed: ResolvedNodeContext | undefined;
    const resolver: NodeContextResolver = {
      registry: SERVER_NODE_MANIFEST_REGISTRY,
      resolve(host) {
        resolveCount += 1;
        return resolveNodeContextByHost(SERVER_NODE_MANIFEST_REGISTRY, host);
      },
    };
    const routes = {
      match: () => ({
        operation: 'identity.sessions.create',
        parameters: {},
        handler: async (input: { readonly headers: Readonly<Record<string, string>> }) => {
          observed = requireRequestNodeContext(input.headers);
          return { status: 200, body: { node: observed.node_id } };
        },
      }),
    } as unknown as RouteRegistry;
    const httpApp = new HttpApp(routes, [], undefined, undefined, undefined, undefined, resolver);
    const outerHandler = {
      handle(request: Request) {
        ingress = requireRequestNodeContext(request.headers);
        return httpApp.handle(request);
      },
    };
    const server = listen(outerHandler, 0, '127.0.0.1', resolver);
    await server.ready;
    try {
      const response = await nodeRequest(server.port(), 'api.fufu.wang', '/api/v1/identity/sessions', 'POST', {
        'x-zdt-identity-entry-host': 'api.hbbtzn.com',
        'x-sfl-node-id': 'node:hbbtzn:l1',
        'x-sfl-node-manifest-id': 'manifest:hbbtzn:l1:v1',
      });
      expect(response.status).toBe(200);
      expect(resolveCount).toBe(1);
      expect(observed).toMatchObject({ node_id: 'node:zhudatuan:l0', surface: 'surface:api' });
      expect(observed).toBe(ingress);
    } finally {
      await server.close();
    }
  });

  it('rejects an unknown ingress Host before an outer handler runs', async () => {
    let handled = false;
    const resolver: NodeContextResolver = {
      registry: SERVER_NODE_MANIFEST_REGISTRY,
      resolve: (host) => resolveNodeContextByHost(SERVER_NODE_MANIFEST_REGISTRY, host),
    };
    const server = listen({
      async handle() {
        handled = true;
        return new Response(null, { status: 204 });
      },
    }, 0, '127.0.0.1', resolver);
    await server.ready;
    try {
      const response = await nodeRequest(server.port(), 'unknown.example');
      expect(response.status).toBe(421);
      expect(response.body).toContain('NODE_BOUNDARY_HOST_MISMATCH');
      expect(handled).toBe(false);
    } finally {
      await server.close();
    }
  });

  it.each([
    ['node:hbbtzn:l1', 'accounts.hbbtzn.com', 'api.fufu.wang'],
    ['node:zhudatuan:l0', 'api.fufu.wang', 'accounts.hbbtzn.com'],
  ] as const)('rejects a foreign Host for %s before a single-node outer handler runs', async (nodeId, ownHost, foreignHost) => {
    const bootstrapped = await bootstrapApi({
      modules: [], operationIds: [], runtimeNodeIds: [nodeId],
      extensions: new ExtensionRegistry({ verify: async () => true } as never),
      configure: bindServerNodeManifestRegistry, allowedOrigins: [], telemetry: commerceTelemetry(),
    });
    let handled = 0;
    const server = listen({ handle: async () => {
      handled += 1;
      return new Response(null, { status: 204 });
    } }, 0, '127.0.0.1', bootstrapped.nodeContextResolver);
    await server.ready;
    try {
      expect((await nodeRequest(server.port(), ownHost)).status).toBe(204);
      const foreign = await nodeRequest(server.port(), foreignHost);
      expect(foreign.status).toBe(421);
      expect(foreign.body).toContain('NODE_BOUNDARY_HOST_MISMATCH');
      expect((await nodeRequest(server.port(), foreignHost, '/api/v1/catalog/public/products', 'GET')).status).toBe(421);
      expect(handled).toBe(1);
    } finally {
      await server.close();
    }
  });

  it('keeps local health probes node-neutral', async () => {
    let resolveCount = 0;
    const resolver: NodeContextResolver = {
      registry: SERVER_NODE_MANIFEST_REGISTRY,
      resolve(host) {
        resolveCount += 1;
        return resolveNodeContextByHost(SERVER_NODE_MANIFEST_REGISTRY, host);
      },
    };
    const server = listen({ handle: async () => new Response(null, { status: 204 }) }, 0, '127.0.0.1', resolver);
    await server.ready;
    try {
      const response = await nodeRequest(server.port(), '127.0.0.1', '/health/ready', 'GET');
      expect(response.status).toBe(204);
      expect(resolveCount).toBe(0);
    } finally {
      await server.close();
    }
  });
});

function nodeRequest(
  port: number,
  host: string,
  path = '/api/v1/identity/sessions',
  method: 'GET' | 'POST' = 'POST',
  extraHeaders: Readonly<Record<string, string>> = {},
): Promise<Readonly<{ status: number; body: string }>> {
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: method === 'POST' ? {
        host,
        'content-type': 'application/json',
        'content-length': '2',
        'x-contract-version': CONTRACT_VERSION,
        ...extraHeaders,
      } : { host, ...extraHeaders },
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }));
    });
    request.once('error', reject);
    request.end(method === 'POST' ? '{}' : undefined);
  });
}

describe('trusted peer address', () => {
  it('accepts Caddy client identity only from the local reverse proxy', () => {
    expect(trustedPeerAddress('203.0.113.8', '127.0.0.1')).toBe('203.0.113.8');
    expect(trustedPeerAddress('2001:db8::8', '::1')).toBe('2001:db8::8');
    expect(trustedPeerAddress('203.0.113.9', '::ffff:127.0.0.1')).toBe('203.0.113.9');
    expect(trustedPeerAddress('203.0.113.8', '198.51.100.2')).toBe('198.51.100.2');
  });

  it('rejects malformed and ambiguous forwarded values', () => {
    expect(trustedPeerAddress('not-an-ip', '127.0.0.1')).toBe('127.0.0.1');
    expect(trustedPeerAddress('203.0.113.8, 198.51.100.2', '127.0.0.1')).toBe('127.0.0.1');
    expect(trustedPeerAddress(['203.0.113.8', '203.0.113.9'], '127.0.0.1')).toBe('127.0.0.1');
    expect(trustedPeerAddress(undefined, undefined)).toBe('unknown');
  });
});
