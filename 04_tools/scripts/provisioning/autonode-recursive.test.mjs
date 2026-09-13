import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import {
  AUTONODE_PROVISIONING_STEPS,
  AUTONODE_RECURSIVE_REQUEST_SCHEMA_VERSION,
  AUTONODE_REQUEST_SCHEMA_VERSION,
  FileNodeProvisioningEngine,
} from './autonode-engine.mjs';

test('one existing L1 recursively provisions L2-L5 with four domain/payment resource combinations', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'autonode-recursive-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const fixture = fixtureFactory(randomUUID());
  const artifact = await sharedArtifact(root, fixture.seed);
  const engine = new FileNodeProvisioningEngine(root);
  const l1Requests = [0, 1, 2].map((index) => fixture.legacyL1(index, artifact));
  const l1Results = await Promise.all(l1Requests.map((request) => engine.provision(request)));

  const requests = [];
  const results = [];
  let parent = l1Results[0];
  const modes = [
    ['INHERIT_PARENT', 'INHERIT_PARENT'],
    ['OWN', 'INHERIT_PARENT'],
    ['INHERIT_PARENT', 'OWN'],
    ['OWN', 'OWN'],
  ];
  for (const [index, [domainMode, paymentMode]] of modes.entries()) {
    const request = fixture.recursive(index, parent.manifest.node_id, artifact, domainMode, paymentMode, index === 3);
    requests.push(request);
    parent = await engine.provision(request);
    results.push(parent);
  }

  const expectedNodeIds = [l1Results[0].manifest.node_id, ...results.map((result) => result.manifest.node_id)];
  for (const [index, result] of results.entries()) {
    const level = index + 2;
    assert.equal(result.manifest.signed_level, `L${level}`);
    assert.equal(result.receipt.level, level);
    assert.equal(result.receipt.root_node_id, fixture.rootNodeId);
    assert.deepEqual(result.receipt.ancestry, [fixture.rootNodeId, ...expectedNodeIds.slice(0, index + 2)]);
    assert.equal(result.manifest.parent_node_id, expectedNodeIds[index]);
  }

  const plans = await Promise.all(results.map((result) => readJson(join(result.nodeDirectory, 'runtime', 'resource-plan.json'))));
  assert.deepEqual(plans.map((plan) => [plan.binding_sources.domains.mode, plan.binding_sources.payment.mode]), modes);
  assert.equal(plans[0].binding_sources.domains.source_node_id, l1Results[0].manifest.node_id);
  assert.equal(plans[0].binding_sources.payment.source_node_id, l1Results[0].manifest.node_id);
  assert(plans.slice(0, 3).every((plan) => plan.resolution_receipts.every((receipt) => receipt.status === 'RESOLVED')));
  assert.equal(plans[3].binding_sources.domains.resolution_status, 'WAITING_EXTERNAL');
  assert.equal(plans[3].external_status, 'WAITING_EXTERNAL');
  assert(plans.every((plan) => plan.resolution_receipts.every((receipt) => 'source_version' in receipt)));
  assert(results[1].manifest.domain_bindings.every((binding) => binding.host.includes(results[1].manifest.node_id.split(':')[1])));
  assert.equal(results[2].manifest.payment_binding_refs[0].ref, plans[2].effective_resources.payment.ref);
  assert.equal(plans[2].effective_resources.payment.secret_ref.ref.includes(results[2].manifest.node_id.split(':')[1]), true);

  const allResults = [...l1Results, ...results];
  assert.equal(new Set(allResults.map((result) => result.manifest.realm_ref.ref)).size, allResults.length);
  assert.equal(new Set(allResults.map((result) => result.manifest.data_scope_ref.ref)).size, allResults.length);
  assert.equal(new Set(allResults.map((result) => result.manifest.mall_id)).size, allResults.length);
  assert.equal(new Set(allResults.map((result) => result.manifest.release_pointer_ref.ref)).size, allResults.length);
  assert(allResults.every((result) => result.receipt.source_sha === artifact.source_sha));
  assert(allResults.every((result) => result.receipt.build_id === artifact.build_id));
  assert(allResults.every((result) => result.receipt.immutable_artifact_digest === artifact.immutable_artifact_digest));
  assert(allResults.every((result) => result.receipt.build_count === 1));
  assert(allResults.every((result) => result.receipt.node_specific_build_count === 0));
  assert(allResults.every((result) => result.receipt.source_tree_copy_count === 0));
  const allPorts = (await Promise.all(allResults.map((result) =>
    readJson(join(result.nodeDirectory, 'runtime', 'resource-plan.json')))))
    .flatMap((plan) => Object.values(plan.ports));
  assert.equal(new Set(allPorts).size, allPorts.length);

  for (const [index, request] of requests.entries()) {
    const replayed = await Promise.all(Array.from({ length: 5 }, () =>
      new FileNodeProvisioningEngine(root).provision(request)));
    assert(replayed.every((result) => result.receipt.candidate_bundle_digest === results[index].receipt.candidate_bundle_digest));
    assert.equal(replayed[0].ledger.step_receipts.length, AUTONODE_PROVISIONING_STEPS.length);
  }

  const l0Control = join(root, 'controls', 'l0');
  await mkdir(l0Control, { recursive: true });
  await writeFile(join(l0Control, 'release-pointer.json'), JSON.stringify({ artifact }), { flag: 'wx' });
  const protectedDirectories = [l0Control, ...l1Results.map((result) => result.nodeDirectory), ...results.slice(0, 3).map((result) => result.nodeDirectory)];
  const before = await Promise.all(protectedDirectories.map(directoryDigest));
  const l5Digest = await directoryDigest(results[3].nodeDirectory);
  await engine.rollback(requests[3], 'recursive leaf rollback proof');
  assert.deepEqual(await Promise.all(protectedDirectories.map(directoryDigest)), before);
  const restored = await engine.restore(requests[3]);
  assert.equal(await directoryDigest(restored.nodeDirectory), l5Digest);
  assert.deepEqual(await Promise.all(protectedDirectories.map(directoryDigest)), before);
});

test('every recursive durable step resumes after a post-commit interruption', async (context) => {
  const roots = [];
  context.after(() => Promise.all(roots.map((root) => rm(root, { recursive: true, force: true }))));
  for (const [index, interruptedStep] of AUTONODE_PROVISIONING_STEPS.entries()) {
    const root = await mkdtemp(join(tmpdir(), 'autonode-recursive-resume-'));
    roots.push(root);
    const fixture = fixtureFactory(randomUUID());
    const artifact = await sharedArtifact(root, fixture.seed);
    const engine = new FileNodeProvisioningEngine(root);
    const parent = await engine.provision(fixture.legacyL1(0, artifact));
    const request = fixture.recursive(index, parent.manifest.node_id, artifact, 'INHERIT_PARENT', 'INHERIT_PARENT', false);
    let interrupted = false;
    await assert.rejects(engine.provision(request, {
      afterStep(step) {
        if (!interrupted && step === interruptedStep) {
          interrupted = true;
          throw new Error(`SIMULATED_RECURSIVE_INTERRUPTION:${step}`);
        }
      },
    }), new RegExp(`SIMULATED_RECURSIVE_INTERRUPTION:${interruptedStep}`));
    const resumed = await engine.provision(request);
    assert.equal(resumed.ledger.state, 'CANDIDATE_READY');
    assert.equal(resumed.ledger.step_receipts.length, AUTONODE_PROVISIONING_STEPS.length);
  }
});

function fixtureFactory(seed) {
  const token = (label) => createHash('sha256').update(`${seed}:${label}`).digest('hex').slice(0, 10);
  const rootNodeId = `node:root-${token('root')}:l0`;
  const lineId = `line:${token('line')}:commerce:v1`;
  const zone = `${token('zone')}.invalid`;
  return {
    seed,
    rootNodeId,
    legacyL1(index, artifact) {
      const id = token(`l1:${index}`);
      const slug = `node-${id}`;
      return baseRequest({
        schema_version: AUTONODE_REQUEST_SCHEMA_VERSION,
        provisioning_request_id: `provisioning:${id}`,
        idempotency_key: `key:${id}`,
        created_at: new Date(Date.UTC(2026, 8, 11, index)).toISOString(),
        line_id: lineId,
        parent_node_id: rootNodeId,
        signed_level: 'L1',
        node_slug: slug,
        display_name: `Fixture ${id}`,
        domains: domainsFor(slug, zone),
        artifact,
        binding_sources: {
          domains: { mode: 'OWN', base_domain: zone, source_binding_ref: `dns:${slug}` },
          wechat_identity: { mode: 'OWN', source_binding_ref: `identity:${slug}` },
          payment: { mode: 'OWN', source_binding_ref: `payment:${slug}` },
        },
      });
    },
    recursive(index, parentNodeId, artifact, domainMode, paymentMode, incompleteDomain) {
      const id = token(`recursive:${index}`);
      const slug = `node-${id}`;
      const ownDomain = domainMode === 'OWN' ? {
        source_binding_ref: versioned(`domain-set:${slug}`),
        dns_ref: versioned(`dns:${slug}`),
        tls_ref: versioned(`tls:${slug}`),
        tunnel_ref: incompleteDomain ? null : versioned(`tunnel:${slug}`),
      } : {};
      const ownPayment = paymentMode === 'OWN' ? {
        source_binding_ref: versioned(`payment:${slug}`),
        provider_ref: versioned(`provider:${slug}`),
        merchant_ref: versioned(`merchant:${slug}`),
        callback_ref: versioned(`callback:${slug}`),
        secret_ref: versioned(`secret:${slug}`),
      } : {};
      return baseRequest({
        schema_version: AUTONODE_RECURSIVE_REQUEST_SCHEMA_VERSION,
        provisioning_request_id: `provisioning:${id}`,
        idempotency_key: `key:${id}`,
        created_at: new Date(Date.UTC(2026, 8, 11, index + 4)).toISOString(),
        line_id: lineId,
        parent_node_id: parentNodeId,
        node_slug: slug,
        display_name: `Fixture ${id}`,
        ...(domainMode === 'OWN' ? { domains: domainsFor(slug, zone) } : {}),
        artifact,
        resources: { tunnel: true, tls: true, secrets: false, wechat_identity: false, payment: true, callbacks: true },
        binding_sources: {
          domains: { mode: domainMode, ...ownDomain },
          payment: { mode: paymentMode, ...ownPayment },
        },
      });
    },
  };
}

function baseRequest(value) {
  const slug = value.node_slug;
  return Object.freeze({
    ...value,
    business: {
      scope_id: `scope:${slug}`,
      enterprise_id: `organization:${slug}`,
      code: `NODE_${slug.slice(5).toUpperCase()}`,
      public_slug: slug,
      name: value.display_name,
    },
    created_by: {
      actor_id: `principal:${slug}`,
      membership_id: `membership:${slug}`,
      authorized_operation: 'provisioning.nodes.create',
    },
    resources: value.resources ?? { tunnel: true, tls: true, secrets: true, wechat_identity: true, payment: true, callbacks: true },
  });
}

function domainsFor(slug, zone) {
  return {
    api: `api.${slug}.${zone}`,
    console: `console.${slug}.${zone}`,
    identity: `identity.${slug}.${zone}`,
    storefront: `store.${slug}.${zone}`,
  };
}

function versioned(ref) {
  return { ref, version: 'fixture-v1' };
}

async function sharedArtifact(root, seed) {
  const payload = Buffer.from(`one immutable recursive artifact ${seed}\n`);
  await writeFile(join(root, 'immutable-artifact.bin'), payload, { flag: 'wx' });
  const digest = createHash('sha256').update(payload).digest('hex');
  return Object.freeze({
    source_sha: createHash('sha256').update(seed).digest('hex').slice(0, 40),
    build_id: `recursive-${digest.slice(0, 12)}`,
    build_count: 1,
    immutable_artifact_digest: `sha256:${digest}`,
    source_tree: 'clean',
    client_version: '1.8.0-candidate',
  });
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function directoryDigest(directory) {
  const entries = await inventory(directory, directory);
  return createHash('sha256').update(JSON.stringify(entries)).digest('hex');
}

async function inventory(directory, root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await inventory(path, root));
    if (entry.isFile()) files.push({ path: path.slice(root.length + 1), digest: createHash('sha256').update(await readFile(path)).digest('hex') });
  }
  return files;
}
