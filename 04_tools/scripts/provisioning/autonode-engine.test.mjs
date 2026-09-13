import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import {
  AUTONODE_LEGACY_REQUEST_SCHEMA_VERSION,
  AUTONODE_PROVISIONING_STEPS,
  AUTONODE_REQUEST_SCHEMA_VERSION,
  FileNodeProvisioningEngine,
  parseNodeProvisioningRequest,
} from './autonode-engine.mjs';

test('one shared artifact provisions three durable and independently rollbackable L1 candidates', async (context) => {
  const root = await candidateRoot();
  context.after(() => rm(root, { recursive: true, force: true }));
  const artifact = await sharedArtifact(root);
  const requests = [0, 1, 2].map((index) => candidateRequest(index, artifact));
  const engine = new FileNodeProvisioningEngine(root);

  const results = await Promise.all(requests.map((request) => engine.provision(request)));
  assert.equal(new Set(results.map((result) => result.manifest.node_id)).size, 3);
  assert.equal(new Set(results.map((result) => result.manifest.manifest_digest)).size, 3);
  assert.equal(new Set(results.map((result) => result.manifest.realm_ref.ref)).size, 3);
  assert.equal(new Set(results.map((result) => result.manifest.data_scope_ref.ref)).size, 3);
  assert.deepEqual(new Set(results.map((result) => result.receipt.source_sha)), new Set([artifact.source_sha]));
  assert.deepEqual(new Set(results.map((result) => result.receipt.build_id)), new Set([artifact.build_id]));
  assert.deepEqual(
    new Set(results.map((result) => result.receipt.immutable_artifact_digest)),
    new Set([artifact.immutable_artifact_digest]),
  );
  assert.deepEqual(new Set(results.map((result) => result.receipt.build_count)), new Set([1]));
  assert.deepEqual(new Set(results.map((result) => result.receipt.source_tree_copy_count)), new Set([0]));
  assert.deepEqual(new Set(results.map((result) => result.receipt.node_specific_build_count)), new Set([0]));
  assert(results.every((result) => result.receipt.production_status === 'PENDING_STABLE_BASELINE'));
  assert(results.every((result) => result.receipt.external_status === 'WAITING_EXTERNAL'));
  assert(results.every((result) => result.manifest.enabled_features.some(({ ref }) => ref === 'feature:catalog')));
  assert(results.every((result) => result.manifest.enabled_features.some(({ ref }) => ref === 'feature:checkout')));
  assert(results.every((result, index) => result.manifest.secret_binding_set_ref.ref
    === `${requests[index].provisioning_request?.node_slug ?? requests[index].node_slug}/nodes/l1/secrets`));

  const resourcePlans = await Promise.all(results.map((result) => readJson(join(result.nodeDirectory, 'runtime', 'resource-plan.json'))));
  const allPorts = resourcePlans.flatMap((plan) => Object.values(plan.ports));
  assert.equal(new Set(allPorts).size, allPorts.length);
  assert(resourcePlans.every((plan) => plan.external_bindings.every((binding) => binding.status === 'WAITING_EXTERNAL')));
  const allHosts = resourcePlans.flatMap((plan) => plan.hosts);
  assert.equal(new Set(allHosts).size, allHosts.length);
  assert(resourcePlans.every((plan) => plan.binding_sources.domains.mode === 'OWN'));
  assert(resourcePlans.every((plan) => plan.binding_sources.payment.mode === 'INHERIT_PARENT'));
  assert(resourcePlans.every((plan) => plan.external_bindings
    .filter(({ kind }) => kind === 'payment')
    .every((binding) => binding.source_binding_ref === 'payment-binding:zhudatuan:l0')));
  assert.equal(new Set(results.map((result) => result.manifest.payment_binding_refs[0].ref)).size, 3);

  const gateway = await readFile(join(results[0].nodeDirectory, 'runtime', 'api-gateway.Caddyfile'), 'utf8');
  assert(gateway.indexOf('path /console-runtime.json') < gateway.indexOf('@console host'));
  assert(gateway.indexOf('path /identity-runtime.json') < gateway.indexOf('@accounts host'));
  const cloudflared = await readFile(join(results[0].nodeDirectory, 'runtime', 'cloudflared.yml'), 'utf8');
  assert.match(cloudflared, /credentials-file: .*\/tunnel\/credentials\.json/);
  assert.match(cloudflared, /metrics: 127\.0\.0\.1:\d+/);
  assert.match(cloudflared, /matchSNItoHost: true/);
  const systemd = await readJson(join(results[0].nodeDirectory, 'runtime', 'systemd-instances.json'));
  assert.equal(systemd.instances.find(({ service }) => service === 'web-api').environment_file,
    join(results[0].nodeDirectory, 'runtime', 'web-api.env'));
  assert.equal(systemd.instances.find(({ service }) => service === 'object-store').environment_file,
    join(results[0].nodeDirectory, 'runtime', 'object-store.env'));
  assert.equal(systemd.instances.find(({ service }) => service === 'cloudflared').environment_file, null);
  const nodeRuntime = await readJson(join(results[0].nodeDirectory, 'runtime', 'console-runtime.json'));
  assert.equal(nodeRuntime.node_manifest.node_id, results[0].manifest.node_id);
  assert.equal(nodeRuntime.immutable_artifact_digest, artifact.immutable_artifact_digest);
  const identityRuntime = await readJson(join(results[0].nodeDirectory, 'runtime', 'identity-runtime.json'));
  assert.equal(identityRuntime.identity_node_registry.nodes[0].nodeId, results[0].manifest.node_id);
  const storefrontEnvironment = await readFile(join(results[0].nodeDirectory, 'runtime', 'storefront.env'), 'utf8');
  assert.match(storefrontEnvironment, /^NEXT_PUBLIC_IDENTITY_NODE_REGISTRY="\{\\"version\\":2,/m);
  assert.match(storefrontEnvironment, new RegExp(`^NODE_RELEASE_POINTER_REF="${results[0].manifest.release_pointer_ref.ref}"$`, 'm'));
  const objectStoreEnvironment = await readFile(join(results[0].nodeDirectory, 'runtime', 'object-store.env'), 'utf8');
  assert.match(objectStoreEnvironment, new RegExp(`^LOCAL_OBJECTS_DIRECTORY="/var/lib/sfl-${requests[0].provisioning_request?.node_slug ?? requests[0].node_slug}-l1-objects"$`, 'm'));

  const replayed = await Promise.all(Array.from(
    { length: 5 },
    () => new FileNodeProvisioningEngine(root).provision(requests[0]),
  ));
  assert(replayed.every((result) => result.receipt.candidate_bundle_digest === results[0].receipt.candidate_bundle_digest));
  assert.equal(replayed[0].ledger.step_receipts.length, AUTONODE_PROVISIONING_STEPS.length);
  assert.deepEqual(Object.values(replayed[0].ledger.attempts), Array(AUTONODE_PROVISIONING_STEPS.length).fill(1));
  assert.equal(replayed[0].ledger.request.hierarchy, undefined);

  const firstBefore = await directoryDigest(results[0].nodeDirectory);
  const thirdBefore = await directoryDigest(results[2].nodeDirectory);
  const rollback = await engine.rollback(requests[1], 'prove isolated candidate rollback');
  assert.equal(rollback.node_id, results[1].manifest.node_id);
  assert.equal(Object.keys(rollback.released_ports).length, 9);
  assert.equal(await directoryDigest(results[0].nodeDirectory), firstBefore);
  assert.equal(await directoryDigest(results[2].nodeDirectory), thirdBefore);
  assert.deepEqual(await engine.rollback(requests[1], 'retry ignored'), rollback);
});

test('new requests make inherited, owned, and disabled bindings explicit while preserving legacy parsing', async () => {
  const root = await candidateRoot();
  try {
    const artifact = await sharedArtifact(root);
    const request = candidateRequest(8, artifact);
    const disabled = {
      ...request,
      resources: { ...request.resources, wechat_identity: false, payment: false, callbacks: false },
      binding_sources: {
        ...request.binding_sources,
        domains: {
          mode: 'INHERIT_PARENT',
          base_domain: 'candidate.invalid',
          source_node_id: request.parent_node_id,
          source_binding_ref: 'dns-zone:candidate.invalid',
        },
        wechat_identity: {
          mode: 'INHERIT_PARENT',
          source_node_id: request.parent_node_id,
          source_binding_ref: 'configuration-set:node:zhudatuan:l0',
        },
        payment: {
          mode: 'INHERIT_PARENT',
          source_node_id: request.parent_node_id,
          source_binding_ref: 'configuration-set:node:zhudatuan:l0',
        },
      },
    };
    const result = await new FileNodeProvisioningEngine(root).provision(disabled);
    assert.equal(result.receipt.binding_sources.domains.mode, 'INHERIT_PARENT');
    assert.equal(result.receipt.binding_sources.wechat_identity.mode, 'INHERIT_PARENT');
    assert.equal(result.receipt.binding_sources.wechat_identity.effective_status, 'DISABLED');
    assert.equal(result.manifest.payment_binding_refs.length, 0);
    assert(!result.manifest.enabled_features.some(({ ref }) => ref === 'feature:wechat-identity'));

    assert.throws(() => parseNodeProvisioningRequest({
      ...disabled,
      binding_sources: {
        ...disabled.binding_sources,
        domains: { ...disabled.binding_sources.domains, source_node_id: 'node:wrong:l0' },
      },
    }), /AUTONODE_PARENT_BINDING_SOURCE_MISMATCH/);
    assert.throws(() => parseNodeProvisioningRequest({
      ...disabled,
      binding_sources: {
        ...disabled.binding_sources,
        payment: { mode: 'DISABLED', source_binding_ref: 'payment:forbidden' },
      },
    }), /AUTONODE_DISABLED_BINDING_SOURCE_FORBIDDEN/);

    const { binding_sources: _bindingSources, ...legacyRequest } = request;
    const { wechat_identity: _wechatIdentity, ...legacyResources } = legacyRequest.resources;
    assert.equal(parseNodeProvisioningRequest({
      ...legacyRequest,
      schema_version: AUTONODE_LEGACY_REQUEST_SCHEMA_VERSION,
      resources: legacyResources,
    }).schema_version, AUTONODE_LEGACY_REQUEST_SCHEMA_VERSION);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('every durable step resumes after an injected post-commit interruption without duplicate work', async (context) => {
  const roots = [];
  context.after(async () => await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true }))));
  for (const [index, interruptedStep] of AUTONODE_PROVISIONING_STEPS.entries()) {
    const root = await candidateRoot();
    roots.push(root);
    const artifact = await sharedArtifact(root);
    const request = candidateRequest(index + 20, artifact);
    const engine = new FileNodeProvisioningEngine(root);
    let interrupted = false;
    await assert.rejects(
      engine.provision(request, {
        afterStep(step) {
          if (!interrupted && step === interruptedStep) {
            interrupted = true;
            throw new Error(`SIMULATED_INTERRUPTION:${step}`);
          }
        },
      }),
      new RegExp(`SIMULATED_INTERRUPTION:${interruptedStep}`),
    );
    const resumed = await engine.provision(request);
    assert.equal(resumed.ledger.state, 'CANDIDATE_READY');
    assert.equal(resumed.ledger.step_receipts.length, AUTONODE_PROVISIONING_STEPS.length);
    assert.deepEqual(Object.values(resumed.ledger.attempts), Array(AUTONODE_PROVISIONING_STEPS.length).fill(1));
  }
});

test('idempotency keys and node claims reject divergent requests', async (context) => {
  const root = await candidateRoot();
  context.after(() => rm(root, { recursive: true, force: true }));
  const artifact = await sharedArtifact(root);
  const engine = new FileNodeProvisioningEngine(root);
  const request = candidateRequest(80, artifact);
  await engine.provision(request);
  await assert.rejects(
    engine.provision({ ...request, display_name: `${request.display_name} changed` }),
    /AUTONODE_IDEMPOTENCY_CONFLICT/,
  );
  await assert.rejects(
    engine.provision({
      ...request,
      provisioning_request_id: `${request.provisioning_request_id}:other`,
      idempotency_key: `${request.idempotency_key}:other`,
    }),
    /AUTONODE_NODE_ALREADY_CLAIMED/,
  );
});

async function candidateRoot() {
  return await mkdtemp(join(tmpdir(), 'autonode-candidate-'));
}

async function sharedArtifact(root) {
  const payload = Buffer.from('one immutable AutoNode candidate artifact\n');
  const file = join(root, 'immutable-artifact.bin');
  await writeFile(file, payload, { flag: 'wx' });
  const fullDigest = createHash('sha256').update(payload).digest('hex');
  return Object.freeze({
    source_sha: createHash('sha256').update('autonode-source').digest('hex').slice(0, 40),
    build_id: `autonode-candidate-${fullDigest.slice(0, 12)}`,
    build_count: 1,
    immutable_artifact_digest: `sha256:${fullDigest}`,
    source_tree: 'clean',
    client_version: '1.8.0-candidate',
  });
}

function candidateRequest(index, artifact) {
  const token = createHash('sha256').update(`candidate-request-${index}`).digest('hex').slice(0, 10);
  const slug = `node-${token}`;
  return Object.freeze({
    schema_version: AUTONODE_REQUEST_SCHEMA_VERSION,
    provisioning_request_id: `provisioning:${token}`,
    idempotency_key: `candidate-key:${token}`,
    created_at: `2026-09-09T0${index % 9}:00:00.000Z`,
    line_id: 'line:zhudatuan:commerce:v1',
    parent_node_id: 'node:zhudatuan:l0',
    signed_level: 'L1',
    node_slug: slug,
    display_name: `Candidate ${token}`,
    domains: {
      api: `api.${slug}.candidate.invalid`,
      console: `console.${slug}.candidate.invalid`,
      identity: `identity.${slug}.candidate.invalid`,
      storefront: `store.${slug}.candidate.invalid`,
    },
    business: {
      scope_id: 'scope:autonode:candidate',
      enterprise_id: 'organization:autonode:candidate',
      code: `NODE_${token.toUpperCase()}`,
      public_slug: slug,
      name: `Candidate ${token}`,
    },
    created_by: {
      actor_id: 'principal:autonode:candidate',
      membership_id: 'membership:autonode:candidate',
      authorized_operation: 'provisioning.nodes.create',
    },
    artifact,
    resources: {
      tunnel: true,
      tls: true,
      secrets: true,
      wechat_identity: true,
      payment: true,
      callbacks: true,
    },
    binding_sources: {
      domains: {
        mode: 'OWN',
        base_domain: 'candidate.invalid',
        source_binding_ref: 'dns-zone:candidate.invalid',
      },
      wechat_identity: {
        mode: 'OWN',
        source_binding_ref: `wechat-identity-config:${slug}`,
      },
      payment: {
        mode: 'INHERIT_PARENT',
        source_node_id: 'node:zhudatuan:l0',
        source_binding_ref: 'payment-binding:zhudatuan:l0',
      },
    },
  });
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function directoryDigest(directory) {
  const entries = await fileEntries(directory, directory);
  return createHash('sha256').update(JSON.stringify(entries)).digest('hex');
}

async function fileEntries(directory, root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await fileEntries(path, root));
    if (entry.isFile()) {
      files.push({
        path: path.slice(root.length + 1),
        digest: createHash('sha256').update(await readFile(path)).digest('hex'),
      });
    }
  }
  return files;
}
