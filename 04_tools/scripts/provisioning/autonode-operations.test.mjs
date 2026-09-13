import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import {
  AUTONODE_OPERATION_REQUEST_SCHEMA_VERSION,
  NodeOperationsEngine,
} from './autonode-operations-engine.mjs';
import {
  AUTONODE_OPERATIONS_STATE_SCHEMA_VERSION,
  ProductionNodeOperationsProvider,
} from './autonode-operations-provider.mjs';

test('operation engine makes successful requests replay-safe and retries failures', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'autonode-operation-engine-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const provider = new MemoryOperationsProvider();
  const engine = new NodeOperationsEngine(join(root, 'state'), provider);
  const pause = request(root, 'pause-1', 'PAUSE');

  const first = await engine.execute(pause);
  const replay = await engine.execute(pause);
  assert.equal(first.status, 'SUCCEEDED');
  assert.equal(replay.replayed, true);
  assert.equal(provider.calls.get('PAUSE'), 1);

  const resume = request(root, 'resume-1', 'RESUME');
  provider.failOnce = true;
  await assert.rejects(engine.execute(resume), /SIMULATED_OPERATION_FAILURE/);
  const retried = await engine.execute(resume);
  assert.equal(retried.status, 'SUCCEEDED');
  assert.equal(retried.attempt, 2);
  assert.equal(provider.calls.get('RESUME'), 2);

  const conflicting = { ...pause, action: { type: 'STATUS' } };
  await assert.rejects(engine.execute(conflicting), /AUTONODE_OPERATION_REPLAY_CONFLICT/);
  const reusedKey = { ...pause, operation_request_id: 'operation:another-id' };
  await assert.rejects(engine.execute(reusedKey), /AUTONODE_OPERATION_REPLAY_CONFLICT/);
});

test('production operations preserve node identity across pause, upgrade, rollback, monitoring and logs', async (context) => {
  const fixture = await nodeFixture();
  context.after(() => rm(fixture.root, { recursive: true, force: true }));
  const provider = new ProductionNodeOperationsProvider({
    runner: fixture.runner,
    fetcher: fixture.fetcher,
    journalctl: fixture.commands.journalctl,
  });
  const engine = new NodeOperationsEngine(join(fixture.root, 'operation-ledger'), provider);

  const initial = await engine.execute(requestForFixture(fixture, 'status-1', 'STATUS'));
  assert.equal(initial.result.runtime_state, 'ACTIVE');
  assert(initial.result.health.every(({ status }) => status === 'READY'));

  const manifestBeforePause = JSON.parse(await readFile(join(fixture.node, 'manifest.json'), 'utf8'));
  const paused = await engine.execute(requestForFixture(fixture, 'pause-1', 'PAUSE'));
  assert.equal(paused.result.runtime_state, 'SUSPENDED');
  assert.equal(paused.result.units.filter(({ active }) => active).length, 0);
  assert.deepEqual(JSON.parse(await readFile(join(fixture.node, 'manifest.json'), 'utf8')), manifestBeforePause);
  assert.equal(await readlink(join(fixture.node, 'current')), fixture.release1);

  const resumed = await engine.execute(requestForFixture(fixture, 'resume-1', 'RESUME'));
  assert.equal(resumed.result.runtime_state, 'ACTIVE');

  const upgraded = await engine.execute(requestForFixture(fixture, 'upgrade-1', 'UPGRADE', {
    release: fixture.releaseEvidence2,
  }));
  assert.equal(upgraded.result.runtime_state, 'ACTIVE');
  assert.equal(upgraded.result.source_sha, fixture.releaseEvidence2.source_sha);
  assert.equal(resolve(await readlink(join(fixture.node, 'current'))), fixture.release2);
  const upgradedManifest = JSON.parse(await readFile(join(fixture.node, 'manifest.json'), 'utf8'));
  assert.equal(upgradedManifest.manifest_version, '1.0.3');
  assert.equal(upgradedManifest.release_pointer_ref.source_sha, fixture.releaseEvidence2.source_sha);
  const environment = await readFile(join(fixture.node, 'runtime', 'catalog-api.env'), 'utf8');
  assert.match(environment, new RegExp(`^SERVICE_VERSION="${fixture.releaseEvidence2.source_sha}"$`, 'm'));

  const replay = await engine.execute(requestForFixture(fixture, 'upgrade-1', 'UPGRADE', {
    release: fixture.releaseEvidence2,
  }));
  assert.equal(replay.replayed, true);

  fixture.failNextRestart = true;
  await assert.rejects(engine.execute(requestForFixture(fixture, 'upgrade-fails', 'UPGRADE', {
    release: fixture.releaseEvidence3,
  })), /SIMULATED_RESTART_FAILURE/);
  assert.equal(resolve(await readlink(join(fixture.node, 'current'))), fixture.release2);
  const afterFailedUpgrade = JSON.parse(await readFile(join(fixture.node, 'manifest.json'), 'utf8'));
  assert.equal(afterFailedUpgrade.release_pointer_ref.source_sha, fixture.releaseEvidence2.source_sha);

  const rolledBack = await engine.execute(requestForFixture(fixture, 'rollback-1', 'ROLLBACK'));
  assert.equal(rolledBack.result.runtime_state, 'ACTIVE');
  assert.equal(rolledBack.result.source_sha, fixture.releaseEvidence1.source_sha);
  assert.equal(resolve(await readlink(join(fixture.node, 'current'))), fixture.release1);

  const logs = await engine.execute(requestForFixture(fixture, 'logs-1', 'LOGS', { line_count: 8 }));
  assert.equal(logs.result.requested_line_count, 8);
  assert(logs.result.services.every(({ lines }) => lines.length <= 2));
  assert(logs.result.operation_history.some(({ action }) => action === 'PAUSE'));
  assert(logs.result.operation_history.some(({ action }) => action === 'UPGRADE'));

  const state = JSON.parse(await readFile(join(fixture.node, 'runtime', 'operations-state.json'), 'utf8'));
  assert.equal(state.schema_version, AUTONODE_OPERATIONS_STATE_SCHEMA_VERSION);
  assert.equal(state.node_id, fixture.nodeId);
  assert.equal(state.pending_transition, null);
  assert(state.history.every(({ actor_id }) => actor_id === 'principal:operations:test'));
});

class MemoryOperationsProvider {
  constructor() {
    this.calls = new Map();
    this.failOnce = false;
  }

  async pause(request) { return await this.execute(request); }
  async resume(request) { return await this.execute(request); }
  async status(request) { return await this.execute(request); }

  async execute(request) {
    this.calls.set(request.action.type, (this.calls.get(request.action.type) ?? 0) + 1);
    if (this.failOnce) {
      this.failOnce = false;
      throw new Error('SIMULATED_OPERATION_FAILURE');
    }
    return { node_id: request.target.node_id, action: request.action.type };
  }
}

async function nodeFixture() {
  const root = await mkdtemp(join(tmpdir(), 'autonode-operations-provider-'));
  const node = join(root, 'nodes', 'operations-l1');
  const release1 = join(root, 'releases', 'v1');
  const release2 = join(root, 'releases', 'v2');
  const release3 = join(root, 'releases', 'v3');
  await Promise.all([node, release1, release2, release3].map((directory) => mkdir(directory, { recursive: true })));
  const nodeId = 'node:operations:l1';
  const releaseEvidence1 = releaseEvidence(release1, '1');
  const releaseEvidence2 = releaseEvidence(release2, '2');
  const releaseEvidence3 = releaseEvidence(release3, '3');
  const manifest = await activeManifest(nodeId, releaseEvidence1);
  const runtime = join(node, 'runtime');
  await mkdir(runtime, { recursive: true });
  await writeJson(join(node, '.autonode-owner.json'), {
    schema_version: 'sfl.autonode-node-owner.v1',
    node_id: nodeId,
  });
  await writeJson(join(node, 'manifest.json'), manifest);
  await writeJson(join(node, 'release-pointer.json'), {
    schema_version: 'sfl.autonode-release-pointer.v1',
    provisioning_request_id: 'provisioning:operations:test',
    node_id: nodeId,
    manifest_id: manifest.manifest_id,
    manifest_version: manifest.manifest_version,
    manifest_digest: manifest.manifest_digest,
    resource_binding_set_ref: manifest.resource_binding_set_ref,
    release_pointer_ref: manifest.release_pointer_ref,
    candidate_status: 'ACTIVE',
  });
  await symlink(release1, join(node, 'current'));
  const instances = ['catalog-api', 'web-api', 'identity-api', 'purchase-api'].map((service) => ({
    service,
    unit: `sfl-${service}@operations-l1.service`,
    environment_file: join(runtime, `${service}.env`),
  }));
  await writeJson(join(runtime, 'systemd-instances.json'), { instances });
  await writeJson(join(runtime, 'resource-plan.json'), {
    ports: { catalog: 21001, web: 21002, identity: 21003, purchase: 21004 },
  });
  for (const { environment_file: file } of instances) {
    await writeFile(file, `SERVICE_VERSION="${releaseEvidence1.source_sha}"\n`);
  }
  await writeJson(join(runtime, 'console-runtime.json'), {
    schema_version: 'sfl.console-node-runtime.v1',
    source_sha: releaseEvidence1.source_sha,
    build_id: releaseEvidence1.build_id,
    build_count: 1,
    source_tree: 'clean',
    client_version: '1.0.0',
    immutable_artifact_digest: releaseEvidence1.immutable_artifact_digest,
    node_manifest: manifest,
    runtime_binding: {
      resource_binding_set_ref: manifest.resource_binding_set_ref,
      api_base_url: 'https://api.operations.invalid',
      identity_entry_url: 'https://accounts.operations.invalid/?target=console',
      scope_kind: 'mall',
    },
  });
  await writeJson(join(runtime, 'identity-runtime.json'), {
    schema_version: 'sfl.identity-node-runtime.v1',
    source_sha: releaseEvidence1.source_sha,
    build_id: releaseEvidence1.build_id,
    build_count: 1,
    immutable_artifact_digest: releaseEvidence1.immutable_artifact_digest,
  });

  const commandsRoot = join(root, 'commands');
  await mkdir(commandsRoot, { recursive: true });
  const commands = {};
  for (const name of ['systemctl', 'caddy', 'cloudflared', 'curl', 'chown', 'journalctl']) {
    commands[name] = join(commandsRoot, name);
    await writeFile(commands[name], '# fixture\n');
  }
  const runtimeProfile = join(root, 'runtime-profile.json');
  await writeJson(runtimeProfile, {
    schema_version: 'sfl.autonode-runtime-profile.v1',
    profile_id: 'operations-fixture',
    environment: 'staging',
    services: {},
    tls: {
      binding_ref: 'tls-binding:operations',
      certificate_file: join(root, 'tls.crt'),
      private_key_file: join(root, 'tls.key'),
      ca_file: join(root, 'ca.crt'),
    },
    cloudflare: {
      account_id: 'account-operations',
      zone_id: 'zone-operations',
      api_token_env: 'OPERATIONS_TOKEN',
    },
    identity_registry: {
      binding_ref: 'identity-registry:operations',
      connection_string_env: 'OPERATIONS_DATABASE_URL',
    },
    commands,
    health: { timeout_ms: 500 },
  });

  const activeUnits = new Set(instances.map(({ unit }) => unit));
  const fixture = {
    root,
    node,
    nodeId,
    release1,
    release2,
    release3,
    releaseEvidence1,
    releaseEvidence2,
    releaseEvidence3,
    runtimeProfile,
    commands,
    activeUnits,
    failNextRestart: false,
  };
  fixture.runner = async (command, args) => {
    if (command === commands.journalctl) {
      return { code: 0, stdout: 'line-1\nline-2\nline-3\n', stderr: '' };
    }
    const [action, unit] = args;
    if (action === 'is-active') return { code: activeUnits.has(unit) ? 0 : 3, stdout: '', stderr: '' };
    if (action === 'start') activeUnits.add(unit);
    if (action === 'stop') activeUnits.delete(unit);
    if (action === 'restart') {
      if (fixture.failNextRestart) {
        fixture.failNextRestart = false;
        throw new Error('SIMULATED_RESTART_FAILURE');
      }
      activeUnits.add(unit);
    }
    return { code: 0, stdout: '', stderr: '' };
  };
  fixture.fetcher = async () => new Response(JSON.stringify({ status: 'ready' }), { status: 200 });
  return fixture;
}

async function activeManifest(nodeId, release) {
  const ref = (value) => ({ ref: value, version: '1' });
  const unsigned = {
    schema_version: 'sfl.node-manifest.v1',
    manifest_id: 'manifest:operations:l1',
    manifest_version: '1.0.2',
    generated_at: '2026-09-14T01:00:00.000Z',
    lifecycle_status: 'active',
    line_id: 'line:zhudatuan:commerce:v1',
    node_id: nodeId,
    parent_node_id: 'node:zhudatuan:l0',
    signed_level: 'L1',
    node_profile: 'operating_mall',
    mall_id: 'mall:operations',
    host_node_id: null,
    domain_bindings: ['api', 'console', 'identity', 'storefront'].map((surface) => ({
      host: `${surface}.operations.invalid`,
      binding_ref: ref(`domain:operations:${surface}`),
      application_ref: `application:${surface}`,
      surface_ref: `surface:${surface}`,
    })),
    brand_ref: ref('brand:operations'),
    applications: ['api', 'console', 'identity', 'storefront'].map((surface) => ref(`application:${surface}`)),
    surfaces: ['api', 'console', 'identity', 'storefront'].map((surface) => ref(`surface:${surface}`)),
    enabled_features: ['catalog', 'checkout', 'commerce', 'console', 'identity', 'storefront'].map((feature) => ref(`feature:${feature}`)),
    api_contract_refs: [{ ref: 'contract:commerce-api', version: '1.0.0' }],
    realm_ref: ref('realm:operations-l1'),
    data_scope_ref: ref('mall:operations'),
    resource_binding_set_ref: ref('resource-binding-set:operations'),
    secret_binding_set_ref: ref('operations/nodes/l1/secrets'),
    payment_binding_refs: [],
    callback_binding_refs: [],
    runtime_instance_id: 'runtime:operations:commerce',
    runtime_config_ref: ref('runtime-config:operations'),
    release_pointer_ref: {
      ref: 'release:operations',
      version: '1',
      source_sha: release.source_sha,
      build_id: release.build_id,
      build_count: 1,
      immutable_artifact_digest: release.immutable_artifact_digest,
    },
  };
  return { ...unsigned, manifest_digest: digestCanonicalJson(unsigned) };
}

function requestForFixture(fixture, id, type, action = {}) {
  return {
    schema_version: AUTONODE_OPERATION_REQUEST_SCHEMA_VERSION,
    operation_request_id: `operation:${id}`,
    idempotency_key: `operation-key:${id}`,
    requested_at: '2026-09-14T02:00:00.000Z',
    requested_by: {
      actor_id: 'principal:operations:test',
      membership_id: 'membership:operations:test',
      authorized_operation: `platform.node.${type.toLowerCase()}`,
    },
    target: {
      node_id: fixture.nodeId,
      node_directory: fixture.node,
      environment: 'staging',
      runtime_profile_ref: fixture.runtimeProfile,
    },
    action: { type, ...action },
  };
}

function request(root, id, type) {
  return {
    schema_version: AUTONODE_OPERATION_REQUEST_SCHEMA_VERSION,
    operation_request_id: `operation:${id}`,
    idempotency_key: `operation-key:${id}`,
    requested_at: '2026-09-14T02:00:00.000Z',
    requested_by: {
      actor_id: 'principal:operations:test',
      membership_id: 'membership:operations:test',
      authorized_operation: `platform.node.${type.toLowerCase()}`,
    },
    target: {
      node_id: 'node:operations:l1',
      node_directory: join(root, 'node'),
      environment: 'staging',
      runtime_profile_ref: join(root, 'runtime-profile.json'),
    },
    action: { type },
  };
}

function releaseEvidence(directory, seed) {
  const digest = createHash('sha256').update(`release-${seed}`).digest('hex');
  return Object.freeze({
    release_directory: directory,
    source_sha: digest.slice(0, 40),
    build_id: `operations-release-${seed}`,
    build_count: 1,
    immutable_artifact_digest: `sha256:${digest}`,
  });
}

async function writeJson(file, value) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

function digestCanonicalJson(value) {
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
