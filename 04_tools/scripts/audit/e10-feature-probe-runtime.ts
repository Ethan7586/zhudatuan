import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

import type { MembershipAccess, Scope } from '@shop/authz';
import { AccessPipeline } from '../../../01_core_hexin/services/commerce/src/foundation/security/AccessPipeline';
import type { Actor } from '../../../01_core_hexin/services/commerce/src/foundation/security/AccessContext';
import { NodeOperationAvailabilityResolver } from '../../../01_core_hexin/services/commerce/src/foundation/security/OperationAvailability';

type Surface = 'page' | 'api' | 'task' | 'service';

interface OperationProbe {
  readonly id: string;
  readonly permission: string;
}

interface IdentityProbe {
  readonly identity_id: string;
  readonly target: Actor['target'];
  readonly membership_client: 'storefront' | 'operator';
  readonly permissions: readonly string[];
  readonly operations: readonly OperationProbe[];
  readonly grant_scope: Scope;
  readonly resolved_scope: Scope;
}

interface NodePolicy {
  readonly node_id: string;
  readonly enabled_features: readonly string[];
  readonly capabilities: readonly string[];
  readonly resource_not_ready_operations: readonly string[];
}

interface ProbePolicy {
  readonly schema_version: string;
  readonly identities: readonly IdentityProbe[];
  readonly nodes: readonly NodePolicy[];
}

const surfaceRoutes = new Map<string, Surface>([
  ['/page/probe', 'page'],
  ['/api/probe', 'api'],
  ['/task/probe', 'task'],
  ['/service/probe', 'service'],
]);
const policyPath = requiredEnvironment('E10_POLICY_PATH');
const allowedNodes = new Set(requiredEnvironment('E10_ALLOWED_NODES').split(',').filter(Boolean));
const [policy, release, marker] = await Promise.all([
  readJson<ProbePolicy>(policyPath),
  readJson<{ release: string; source_sha: string; build_id: string; built_at: string }>(new URL('../release-version.json', import.meta.url)),
  readFile(new URL('../shared-marker.txt', import.meta.url), 'utf8').then((value) => value.trim()),
]);
const identities = new Map(policy.identities.map((identity) => [identity.identity_id, identity]));
const nodes = new Map(policy.nodes.map((node) => [node.node_id, node]));
const now = new Date('2026-09-14T00:00:00.000Z');

const server = createServer(async (request, response) => {
  try {
    if (request.method !== 'GET') return json(response, 405, { error: 'METHOD_NOT_ALLOWED' });
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (url.pathname === '/health') {
      const nodeId = requiredQuery(url, 'node');
      requireAllowedNode(nodeId);
      return json(response, 200, {
        status: 'ready',
        node_id: nodeId,
        process_id: process.pid,
        release: release.release,
        source_sha: release.source_sha,
        build_id: release.build_id,
        marker,
      });
    }
    const surface = surfaceRoutes.get(url.pathname);
    if (!surface) return json(response, 404, { error: 'ROUTE_NOT_FOUND' });
    const nodeId = requiredQuery(url, 'node');
    const identityId = requiredQuery(url, 'identity');
    requireAllowedNode(nodeId);
    const node = nodes.get(nodeId);
    const identity = identities.get(identityId);
    if (!node) throw new Error('NODE_POLICY_MISSING');
    if (!identity) throw new Error('IDENTITY_POLICY_MISSING');
    return json(response, 200, await probe(node, identity, surface));
  } catch (cause) {
    return json(response, 400, { error: errorCode(cause) });
  }
});

server.listen(8787, '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => server.close(() => process.exit(0)));

async function probe(node: NodePolicy, identity: IdentityProbe, surface: Surface) {
  const actor: Actor = Object.freeze({
    id: `actor:${identity.identity_id}:${node.node_id}`,
    account: `account:${identity.identity_id}`,
    realm: `realm:${node.node_id}`,
    membershipClient: identity.membership_client,
    governanceOrganization: `organization:${node.node_id}`,
    nodeContext: Object.freeze({
      host: `${node.node_id.toLowerCase()}.e10.invalid`,
      line_id: 'line:e10:shared',
      node_id: node.node_id,
      signed_level: 'L1',
      node_profile: 'operating_mall',
      realm: Object.freeze({ ref: `realm:${node.node_id}`, version: '1' }),
      manifest: Object.freeze({
        lifecycle_status: 'active',
        enabled_features: Object.freeze(node.enabled_features.map((feature) => Object.freeze({ ref: `feature:${feature}`, version: '1' }))),
        resource_binding_set_ref: Object.freeze({ ref: `resource-binding:${node.node_id}`, version: '1' }),
        runtime_config_ref: Object.freeze({ ref: `runtime:${node.node_id}`, version: '1' }),
        release_pointer_ref: Object.freeze({ ref: `/e10/${node.node_id}/current`, version: '1' }),
      }),
    } as never),
    session: `session:${identity.identity_id}:${node.node_id}`,
    membership: `membership:${identity.identity_id}:${node.node_id}`,
    credentialVersion: 1,
    accessVersion: 1,
    target: identity.target,
    assurance: Object.freeze({ level: 1 }),
  });
  const membership: MembershipAccess = Object.freeze({
    id: actor.membership,
    active: true,
    accessVersion: actor.accessVersion,
    denies: Object.freeze([]),
    grants: Object.freeze([Object.freeze({
      scope: Object.freeze(identity.grant_scope),
      permissions: Object.freeze([...identity.permissions]),
      effective: '2026-01-01T00:00:00.000Z',
      expires: null,
    })]),
  });
  const decisions: Array<Readonly<{ operation: string; outcome: string; reason: string }>> = [];
  const availability = new NodeOperationAvailabilityResolver({
    async ready(_context, operation) {
      return !node.resource_not_ready_operations.includes(operation);
    },
  });
  const pipeline = new AccessPipeline(
    { async resolve() { return actor; } },
    { async resolve() { return membership; } },
    { async resolve() { return actor.accessVersion; } },
    { async resolve() { return Object.freeze(identity.resolved_scope); } },
    { async resolve() { return Object.freeze([...node.capabilities]); } },
    availability,
    { now: () => now },
    { async evaluate() { return Object.freeze({ outcome: 'allow', safeReason: 'policy', decision: null }); } },
    { async append(decision) { decisions.push(Object.freeze({ operation: decision.operation, outcome: decision.outcome, reason: decision.reason })); } },
  );
  const results = [];
  for (const operation of identity.operations) {
    try {
      await pipeline.authorize({
        'x-trace-id': `e10:${surface}:${node.node_id}:${identity.identity_id}:${operation.id}`,
      }, operation.id, operation.permission);
      results.push(Object.freeze({ operation: operation.id, allowed: true, reason: 'POLICY_ALLOWED' }));
    } catch (cause) {
      results.push(Object.freeze({ operation: operation.id, allowed: false, reason: errorCode(cause) }));
    }
  }
  return Object.freeze({
    schema_version: 'e10-feature-probe-response-v1',
    engine: 'AccessPipeline+NodeOperationAvailabilityResolver',
    node_id: node.node_id,
    identity_id: identity.identity_id,
    surface,
    release: release.release,
    source_sha: release.source_sha,
    build_id: release.build_id,
    marker,
    results,
    decisions,
  });
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_MISSING`);
  return value;
}

function requiredQuery(url: URL, name: string): string {
  const value = url.searchParams.get(name);
  if (!value) throw new Error(`${name.toUpperCase()}_MISSING`);
  return value;
}

function requireAllowedNode(nodeId: string): void {
  if (!allowedNodes.has(nodeId)) throw new Error('NODE_NOT_ROUTED_BY_PROCESS');
}

function errorCode(cause: unknown): string {
  if (typeof cause === 'object' && cause !== null && 'code' in cause && typeof cause.code === 'string') return cause.code;
  return cause instanceof Error ? cause.message : 'PROBE_FAILED';
}

function json(response: import('node:http').ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(`${JSON.stringify(body)}\n`);
}

async function readJson<T>(path: string | URL): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}
