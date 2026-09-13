import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import {
  AUTONODE_ACTIVATION_REQUEST_SCHEMA_VERSION,
  AUTONODE_ACTIVATION_STEPS,
  NodeActivationEngine,
} from './autonode-activation-engine.mjs';
import {
  AUTONODE_RECURSIVE_REQUEST_SCHEMA_VERSION,
  AUTONODE_REQUEST_SCHEMA_VERSION,
  FileNodeProvisioningEngine,
} from './autonode-engine.mjs';

test('three sibling L1 activations share one artifact and isolate rollback and restore', async (context) => {
  const root = await activationRoot();
  context.after(() => rm(root, { recursive: true, force: true }));
  const provider = new MemoryProvider();
  const artifact = sharedArtifact();
  const requests = [0, 1, 2].map((index) => activationRequest(root, index, artifact));
  const engines = requests.map(() => new NodeActivationEngine(root, provider));
  const plans = await Promise.all(engines.map((engine, index) => engine.plan(requests[index])));
  const active = await Promise.all(engines.map((engine, index) =>
    engine.apply(requests[index], plans[index].plan.plan_digest)));

  assert(active.every(({ ledger }) => ledger.status === 'ACTIVE'));
  assert.equal(new Set(active.map(({ candidate }) => candidate.manifest.node_id)).size, 3);
  assert.equal(new Set(active.map(({ plan }) => plan.node_directory)).size, 3);
  assert.equal(new Set(active.flatMap(({ plan }) => plan.hosts)).size, 12);
  assert.deepEqual(new Set(active.map(({ plan }) => plan.source_sha)), new Set([artifact.source_sha]));
  assert.deepEqual(new Set(active.map(({ plan }) => plan.build_id)), new Set([artifact.build_id]));
  assert.deepEqual(
    new Set(active.map(({ plan }) => plan.immutable_artifact_digest)),
    new Set([artifact.immutable_artifact_digest]),
  );
  assert(active.every(({ plan }) => plan.build_count === 1
    && plan.source_tree_copy_count === 0
    && plan.node_specific_build_count === 0));

  const replayed = await Promise.all(Array.from({ length: 5 }, () =>
    engines[0].apply(requests[0], plans[0].plan.plan_digest)));
  assert(replayed.every(({ ledger }) => ledger.step_receipts.length === AUTONODE_ACTIVATION_STEPS.length));
  assert.equal(provider.creationsFor(active[0].candidate.manifest.node_id), AUTONODE_ACTIVATION_STEPS.length);

  const firstBefore = provider.snapshot(active[0].candidate.manifest.node_id);
  const thirdBefore = provider.snapshot(active[2].candidate.manifest.node_id);
  const rolledBack = await engines[1].rollback(requests[1], 'C1 isolated rollback proof');
  assert.equal(rolledBack.ledger.status, 'ROLLED_BACK');
  assert.equal(provider.snapshot(active[0].candidate.manifest.node_id), firstBefore);
  assert.equal(provider.snapshot(active[2].candidate.manifest.node_id), thirdBefore);
  assert.equal(provider.snapshot(active[1].candidate.manifest.node_id), emptySnapshot());

  const restored = await engines[1].restore(requests[1], plans[1].plan.plan_digest);
  assert.equal(restored.ledger.status, 'ACTIVE');
  assert.equal(restored.ledger.generation, 2);
  assert.equal(provider.snapshot(active[0].candidate.manifest.node_id), firstBefore);
  assert.equal(provider.snapshot(active[2].candidate.manifest.node_id), thirdBefore);
  assert.notEqual(provider.snapshot(active[1].candidate.manifest.node_id), emptySnapshot());
});

test('a recursive child resolves its level and inherited hosts before activation', async (context) => {
  const root = await activationRoot();
  context.after(() => rm(root, { recursive: true, force: true }));
  const artifact = sharedArtifact();
  const parentRequest = activationRequest(root, 3, artifact);
  const parent = await new FileNodeProvisioningEngine(join(root, 'candidate'))
    .provision(parentRequest.provisioning_request);
  const request = recursiveActivationRequest(root, parent.manifest.node_id, artifact);
  const engine = new NodeActivationEngine(root, new MemoryProvider());

  const planned = await engine.plan(request);
  assert.equal(planned.candidate.manifest.signed_level, 'L2');
  assert.equal(planned.plan.node_id, planned.candidate.manifest.node_id);
  assert(planned.plan.node_directory.endsWith('/child-runtime-l2'));
  assert(planned.plan.hosts.every((host) => host.startsWith('child-runtime.')));

  const active = await engine.apply(request, planned.plan.plan_digest);
  assert.equal(active.ledger.status, 'ACTIVE');
});

test('every real-provider step resumes after interruption without duplicate resources', async (context) => {
  const roots = [];
  context.after(async () => await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true }))));
  for (const [index, step] of AUTONODE_ACTIVATION_STEPS.entries()) {
    const root = await activationRoot();
    roots.push(root);
    const provider = new MemoryProvider();
    const request = activationRequest(root, index + 20, sharedArtifact());
    const engine = new NodeActivationEngine(root, provider);
    const planned = await engine.plan(request);
    let interrupted = false;
    await assert.rejects(engine.apply(request, planned.plan.plan_digest, {
      afterProvider(completed) {
        if (!interrupted && completed === step) {
          interrupted = true;
          throw new Error(`SIMULATED_PROVIDER_INTERRUPTION:${step}`);
        }
      },
    }), new RegExp(`SIMULATED_PROVIDER_INTERRUPTION:${step}`));
    const resumed = await engine.apply(request, planned.plan.plan_digest);
    assert.equal(resumed.ledger.status, 'ACTIVE');
    assert.equal(provider.creationsForStep(step), 1);
  }
});

test('missing provider inputs remain WAITING_EXTERNAL and perform no work', async (context) => {
  const root = await activationRoot();
  context.after(() => rm(root, { recursive: true, force: true }));
  const provider = new MemoryProvider(['runtime-profile', 'cloudflare-api-token']);
  const request = activationRequest(root, 90, sharedArtifact());
  const engine = new NodeActivationEngine(root, provider);
  const planned = await engine.plan(request);
  const waiting = await engine.apply(request, planned.plan.plan_digest);
  assert.equal(waiting.ledger.status, 'WAITING_EXTERNAL');
  assert.deepEqual(waiting.ledger.waiting_external, ['cloudflare-api-token', 'runtime-profile']);
  assert.equal(provider.totalCreations(), 0);
});

test('apply requires the exact approved immutable plan', async (context) => {
  const root = await activationRoot();
  context.after(() => rm(root, { recursive: true, force: true }));
  const request = activationRequest(root, 91, sharedArtifact());
  const engine = new NodeActivationEngine(root, new MemoryProvider());
  await assert.rejects(engine.apply(request, `sha256:${'0'.repeat(64)}`), /AUTONODE_ACTIVATION_PLAN_NOT_APPROVED/);
});

test('rollback compensates a provider step interrupted before its receipt', async (context) => {
  const root = await activationRoot();
  context.after(() => rm(root, { recursive: true, force: true }));
  const provider = new InterruptedProcessProvider();
  const request = activationRequest(root, 92, sharedArtifact());
  const engine = new NodeActivationEngine(root, provider);
  const planned = await engine.plan(request);

  await assert.rejects(
    engine.apply(request, planned.plan.plan_digest),
    /SIMULATED_PROCESS_START_INTERRUPTION/,
  );
  const rolledBack = await engine.rollback(request, 'interrupted process rollback proof');

  assert.equal(rolledBack.ledger.status, 'ROLLED_BACK');
  assert.equal(provider.snapshot(rolledBack.ledger.node_id), emptySnapshot());
  assert.equal(rolledBack.ledger.rollback_receipts.length, 1);
});

class MemoryProvider {
  constructor(waiting = []) {
    this.waiting = waiting;
    this.invocations = new Map();
    this.rollbacks = new Map();
    this.resources = new Map();
    this.creationCounts = new Map();
  }

  async preflight() {
    return this.waiting;
  }

  async apply(step, context, invocationId) {
    const existing = this.invocations.get(invocationId);
    if (existing) return existing;
    const nodeId = context.candidate.manifest.node_id;
    const reference = `${nodeId}:${step.toLowerCase()}:${invocationId.slice(0, 12)}`;
    const receipt = Object.freeze({
      schema_version: 'sfl.autonode-memory-provider-receipt.v1',
      provider: 'memory',
      status: 'APPLIED',
      step,
      invocation_id: invocationId,
      node_id: nodeId,
      resource_refs: [reference],
      resource_digest: digest({ step, nodeId, reference }),
      created_by_request: true,
    });
    this.invocations.set(invocationId, receipt);
    if (!this.resources.has(nodeId)) this.resources.set(nodeId, new Map());
    this.resources.get(nodeId).set(step, reference);
    this.creationCounts.set(step, (this.creationCounts.get(step) ?? 0) + 1);
    return receipt;
  }

  async rollback(step, context, applied, invocationId) {
    const existing = this.rollbacks.get(invocationId);
    if (existing) return existing;
    const nodeId = context.candidate.manifest.node_id;
    const resources = this.resources.get(nodeId);
    if (resources?.get(step) === applied.resource_refs[0]) resources.delete(step);
    const receipt = Object.freeze({
      schema_version: 'sfl.autonode-memory-provider-rollback-receipt.v1',
      provider: 'memory',
      status: 'ROLLED_BACK',
      step,
      invocation_id: invocationId,
      node_id: nodeId,
      released_resource_refs: applied.resource_refs,
    });
    this.rollbacks.set(invocationId, receipt);
    return receipt;
  }

  snapshot(nodeId) {
    const resources = [...(this.resources.get(nodeId)?.entries() ?? [])].sort(([left], [right]) => left.localeCompare(right));
    return digest(resources);
  }

  creationsFor(nodeId) {
    return [...this.invocations.values()].filter((receipt) => receipt.node_id === nodeId).length;
  }

  creationsForStep(step) {
    return this.creationCounts.get(step) ?? 0;
  }

  totalCreations() {
    return this.invocations.size;
  }
}

class InterruptedProcessProvider extends MemoryProvider {
  interrupted = false;

  async apply(step, context, invocationId) {
    const receipt = await super.apply(step, context, invocationId);
    if (step === 'PROCESSES_READY' && !this.interrupted) {
      this.interrupted = true;
      throw new Error('SIMULATED_PROCESS_START_INTERRUPTION');
    }
    return receipt;
  }

  async rollbackInterrupted(step, context, interruptedInvocationId, rollbackInvocationId) {
    const receipt = this.invocations.get(interruptedInvocationId);
    if (!receipt) throw new Error('SIMULATED_INTERRUPTED_RECEIPT_MISSING');
    return await this.rollback(step, context, receipt, rollbackInvocationId);
  }
}

async function activationRoot() {
  const root = await mkdtemp(join(tmpdir(), 'autonode-activation-'));
  await mkdir(join(root, 'release'), { recursive: true });
  await writeFile(join(root, 'runtime-profile.json'), '{}\n');
  return root;
}

function sharedArtifact() {
  const token = createHash('sha256').update('one-c1-release').digest('hex');
  return Object.freeze({
    source_sha: token.slice(0, 40),
    build_id: `autonode-c1-${token.slice(0, 12)}`,
    build_count: 1,
    immutable_artifact_digest: `sha256:${token}`,
    source_tree: 'clean',
    client_version: '1.8.0-c1',
  });
}

function activationRequest(root, index, artifact) {
  const token = createHash('sha256').update(`c1-request-${index}`).digest('hex').slice(0, 10);
  const slug = `node-${token}`;
  return Object.freeze({
    schema_version: AUTONODE_ACTIVATION_REQUEST_SCHEMA_VERSION,
    activation_request_id: `activation:${token}`,
    idempotency_key: `activation-key:${token}`,
    provisioning_request: {
      schema_version: AUTONODE_REQUEST_SCHEMA_VERSION,
      provisioning_request_id: `provisioning:${token}`,
      idempotency_key: `provisioning-key:${token}`,
      created_at: `2026-09-09T${String(index % 24).padStart(2, '0')}:00:00.000Z`,
      line_id: 'line:zhudatuan:commerce:v1',
      parent_node_id: 'node:zhudatuan:l0',
      signed_level: 'L1',
      node_slug: slug,
      display_name: `C1 ${token}`,
      domains: {
        api: `api-${slug}.example.invalid`,
        console: `console-${slug}.example.invalid`,
        identity: `accounts-${slug}.example.invalid`,
        storefront: `store-${slug}.example.invalid`,
      },
      business: {
        scope_id: 'scope:autonode:c1',
        enterprise_id: 'organization:autonode:c1',
        code: `C1_${token.toUpperCase()}`,
        public_slug: slug,
        name: `C1 ${token}`,
      },
      created_by: {
        actor_id: 'principal:autonode:c1',
        membership_id: 'membership:autonode:c1',
        authorized_operation: 'provisioning.nodes.create',
      },
      artifact,
      resources: {
        tunnel: true,
        tls: true,
        secrets: true,
        wechat_identity: false,
        payment: false,
        callbacks: false,
      },
      binding_sources: {
        domains: {
          mode: 'OWN',
          base_domain: 'example.invalid',
          source_binding_ref: 'dns-zone:example.invalid',
        },
        wechat_identity: { mode: 'DISABLED' },
        payment: { mode: 'DISABLED' },
      },
    },
    target: {
      environment: 'staging',
      node_root: join(root, 'nodes'),
      release_directory: join(root, 'release'),
      runtime_profile_ref: join(root, 'runtime-profile.json'),
      systemd_unit_root: join(root, 'systemd'),
    },
  });
}

function recursiveActivationRequest(root, parentNodeId, artifact) {
  return Object.freeze({
    schema_version: AUTONODE_ACTIVATION_REQUEST_SCHEMA_VERSION,
    activation_request_id: 'activation:child-runtime',
    idempotency_key: 'activation-key:child-runtime',
    provisioning_request: {
      schema_version: AUTONODE_RECURSIVE_REQUEST_SCHEMA_VERSION,
      provisioning_request_id: 'provisioning:child-runtime',
      idempotency_key: 'provisioning-key:child-runtime',
      created_at: '2026-09-09T04:00:00.000Z',
      line_id: 'line:zhudatuan:commerce:v1',
      parent_node_id: parentNodeId,
      node_slug: 'child-runtime',
      display_name: 'Child runtime',
      business: {
        scope_id: 'scope:autonode:child',
        enterprise_id: 'organization:autonode:child',
        code: 'CHILD_RUNTIME',
        public_slug: 'child-runtime',
        name: 'Child runtime',
      },
      created_by: {
        actor_id: 'principal:autonode:child',
        membership_id: 'membership:autonode:child',
        authorized_operation: 'provisioning.nodes.create',
      },
      artifact,
      resources: {
        tunnel: true,
        tls: true,
        secrets: true,
        wechat_identity: false,
        payment: false,
        callbacks: false,
      },
      binding_sources: {
        domains: { mode: 'INHERIT_PARENT' },
        payment: { mode: 'DISABLED' },
      },
    },
    target: {
      environment: 'staging',
      node_root: join(root, 'nodes'),
      release_directory: join(root, 'release'),
      runtime_profile_ref: join(root, 'runtime-profile.json'),
      systemd_unit_root: join(root, 'systemd'),
    },
  });
}

function digest(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function emptySnapshot() {
  return digest([]);
}
