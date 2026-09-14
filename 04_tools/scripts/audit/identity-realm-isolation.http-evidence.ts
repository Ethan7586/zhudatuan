import { request as httpRequest } from 'node:http';
import { writeFile } from 'node:fs/promises';
import {
  resolveNodeContextByHost,
  type NodeContextResolver,
  type NodeManifestRegistry,
  type ResolvedNodeContext,
} from '@shop/config/sfl-node-kernel';
import { SERVER_NODE_MANIFEST_REGISTRY } from '../../../01_core_hexin/services/commerce/src/bootstrap/ApiBootstrap';
import { listen } from '../../../01_core_hexin/services/commerce/src/foundation/interface/NodeServer';
import { requireRequestNodeContext } from '../../../01_core_hexin/services/commerce/src/foundation/security/AccessContext';

const outputPath = option('--output');
const nodeAManifest = manifest('node:hbbtzn:l1');
const nodeBManifest = manifest('node:zhudatuan:l0');
const nodeAHost = apiHost(nodeAManifest);
const nodeBHost = apiHost(nodeBManifest);
const nodeA = authority(nodeAManifest, nodeAHost);
const nodeB = authority(nodeBManifest, nodeBHost);
const canonicalResolver = resolver(SERVER_NODE_MANIFEST_REGISTRY);
const ambiguousResolver = resolver(ambiguousRegistry(nodeAHost));

const positiveCases = [
  await probe('E12-POS-A-A', nodeAHost, canonicalResolver),
  await probe('E12-POS-B-B', nodeBHost, canonicalResolver),
];
const invalidCases = [
  await probe('E12-NEG-01-UNKNOWN-HOST', 'unknown.e12.invalid', canonicalResolver),
  await probe('E12-NEG-02-AMBIGUOUS-HOST', nodeAHost, ambiguousResolver),
];
const forgeryInputs = [
  ['realm', nodeB.realm_id, 'x-realm-id'],
  ['membership', 'membership:realm-isolation:l0', 'x-membership-id'],
  ['scope', 'tenant-zhudatuan', 'x-scope-hint'],
  ['node_id', nodeB.node_id, 'x-sfl-node-id'],
  ['mall_id', nodeB.mall_id, 'x-mall-id'],
  ['role', 'role-platform-owner-v2', 'x-role'],
] as const;
const forgeryCases = [];
for (const [field, value, header] of forgeryInputs) {
  const observed = await probe(`E12-FORGE-${field.toUpperCase()}`, nodeAHost, canonicalResolver, {
    [header]: String(value),
  }, { [field]: value });
  forgeryCases.push(Object.freeze({ ...observed, field }));
}

await writeFile(outputPath, `${JSON.stringify({
  schema_version: 'e12-http-raw-evidence-v1',
  captured_at: new Date().toISOString(),
  baselines: { node_a: nodeA, node_b: nodeB },
  positive_cases: positiveCases,
  invalid_cases: invalidCases,
  forgery_cases: forgeryCases,
}, null, 2)}\n`, { flag: 'wx' });

function option(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (!value) throw new Error(`E12_HTTP_EVIDENCE_OPTION_REQUIRED:${name}`);
  return value;
}

function manifest(nodeId: string) {
  const found = SERVER_NODE_MANIFEST_REGISTRY.manifests.find((candidate) => candidate.node_id === nodeId);
  if (!found) throw new Error(`E12_HTTP_MANIFEST_MISSING:${nodeId}`);
  return found;
}

function apiHost(nodeManifest: ReturnType<typeof manifest>): string {
  const binding = nodeManifest.domain_bindings.find((candidate) => candidate.surface_ref === 'surface:api');
  if (!binding) throw new Error(`E12_HTTP_API_HOST_MISSING:${nodeManifest.node_id}`);
  return binding.host;
}

function authority(nodeManifest: ReturnType<typeof manifest>, host: string) {
  return Object.freeze({
    node_id: nodeManifest.node_id,
    realm_id: nodeManifest.realm_ref.ref,
    scope_id: nodeManifest.data_scope_ref.ref,
    mall_id: nodeManifest.mall_id,
    host,
  });
}

function resolver(registry: NodeManifestRegistry): NodeContextResolver {
  return Object.freeze({
    registry,
    resolve: (host: string) => resolveNodeContextByHost(registry, host),
  });
}

function ambiguousRegistry(host: string): NodeManifestRegistry {
  const source = nodeAManifest.domain_bindings.find((binding) => binding.host === host);
  if (!source) throw new Error('E12_HTTP_AMBIGUOUS_SOURCE_BINDING_MISSING');
  const conflicting = Object.freeze({
    ...nodeBManifest,
    domain_bindings: Object.freeze([...nodeBManifest.domain_bindings, Object.freeze({
      ...source,
      binding_ref: Object.freeze({ ref: 'binding:e12:ambiguous-host', version: source.binding_ref.version }),
    })]),
  });
  return Object.freeze({
    ...SERVER_NODE_MANIFEST_REGISTRY,
    registry_version: 'e12-ambiguous-host-fixture',
    manifests: Object.freeze([nodeAManifest, conflicting]),
  }) as NodeManifestRegistry;
}

async function probe(
  caseId: string,
  host: string,
  nodeResolver: NodeContextResolver,
  extraHeaders: Readonly<Record<string, string>> = {},
  body: Readonly<Record<string, unknown>> = {},
) {
  let directResolution: ResolvedNodeContext | null = null;
  let resolverError: ReturnType<typeof serializeError> | null = null;
  try {
    directResolution = nodeResolver.resolve(host);
  } catch (cause) {
    resolverError = serializeError(cause);
  }

  let handlerInvocations = 0;
  let handlerContext: ResolvedNodeContext | null = null;
  const server = listen({
    handle(request: Request) {
      handlerInvocations += 1;
      handlerContext = requireRequestNodeContext(request.headers);
      return Promise.resolve(Response.json(contextProjection(handlerContext), { status: 200 }));
    },
  }, 0, '127.0.0.1', nodeResolver);
  await server.ready;
  let response;
  try {
    response = await request(server.port(), host, extraHeaders, body);
  } finally {
    await server.close();
  }
  return Object.freeze({
    case_id: caseId,
    request: {
      method: 'POST',
      path: '/api/v1/e12/authority-probe',
      host,
      headers: extraHeaders,
      body,
    },
    response,
    resolver_error: resolverError,
    direct_resolved_context: directResolution === null ? null : contextProjection(directResolution),
    handler_invocations: handlerInvocations,
    handler_context: handlerContext === null ? null : contextProjection(handlerContext),
  });
}

function request(port: number, host: string, extraHeaders: Readonly<Record<string, string>>, body: Readonly<Record<string, unknown>>) {
  const payload = JSON.stringify(body);
  return new Promise<Readonly<{ status: number; body: string }>>((resolve, reject) => {
    const outgoing = httpRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/v1/e12/authority-probe',
      method: 'POST',
      headers: {
        host,
        'content-type': 'application/json',
        'content-length': String(Buffer.byteLength(payload)),
        ...extraHeaders,
      },
    }, (incoming) => {
      const chunks: Buffer[] = [];
      incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
      incoming.on('end', () => resolve(Object.freeze({
        status: incoming.statusCode ?? 0,
        body: Buffer.concat(chunks).toString('utf8'),
      })));
    });
    outgoing.once('error', reject);
    outgoing.end(payload);
  });
}

function contextProjection(context: ResolvedNodeContext) {
  return Object.freeze({
    host: context.host,
    line_id: context.line_id,
    node_id: context.node_id,
    parent_node_id: context.parent_node_id,
    signed_level: context.signed_level,
    node_profile: context.node_profile,
    mall_id: context.mall_id,
    scope_id: context.scope.ref,
    realm_id: context.realm.ref,
    manifest_id: context.manifest.manifest_id,
  });
}

function serializeError(cause: unknown) {
  return Object.freeze({
    name: cause instanceof Error ? cause.name : 'Error',
    message: cause instanceof Error ? cause.message : String(cause),
  });
}
