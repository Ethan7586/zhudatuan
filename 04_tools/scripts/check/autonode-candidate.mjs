// Candidate evidence only; never contacts production or external providers.
// After one Console build:
//   node --import tsx 04_tools/scripts/check/autonode-candidate.mjs \
//     --output /absolute/candidate-root \
//     --console-artifact 01_core_hexin/apps/console/dist/console-build.json

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';

import {
  AUTONODE_PROVISIONING_STEPS,
  AUTONODE_REQUEST_SCHEMA_VERSION,
  FileNodeProvisioningEngine,
} from '../provisioning/autonode-engine.mjs';

const { values } = parseArgs({
  options: {
    output: { type: 'string' },
    'console-artifact': { type: 'string' },
  },
  strict: true,
});
const root = values.output ? resolve(values.output) : await mkdtemp(join(tmpdir(), 'autonode-evidence-'));
const artifact = values['console-artifact']
  ? artifactFromConsole(await readJson(resolve(values['console-artifact'])))
  : await materializeSingleArtifact(root);
const engine = new FileNodeProvisioningEngine(root);
const requests = [0, 1, 2].map((index) => requestFor(index, artifact));
const results = await Promise.all(requests.map((request) => engine.provision(request)));

assert.equal(new Set(results.map((result) => result.manifest.node_id)).size, 3);
assert.equal(new Set(results.map((result) => result.manifest.manifest_digest)).size, 3);
assert.equal(new Set(results.map((result) => result.manifest.realm_ref.ref)).size, 3);
assert.equal(new Set(results.map((result) => result.manifest.data_scope_ref.ref)).size, 3);
assert(results.every((result) => result.receipt.source_sha === artifact.source_sha));
assert(results.every((result) => result.receipt.build_id === artifact.build_id));
assert(results.every((result) => result.receipt.build_count === 1));
assert(results.every((result) => result.receipt.immutable_artifact_digest === artifact.immutable_artifact_digest));
assert(results.every((result) => result.receipt.source_tree_copy_count === 0));
assert(results.every((result) => result.receipt.node_specific_build_count === 0));

const resources = await Promise.all(results.map((result) =>
  readJson(join(result.nodeDirectory, 'runtime', 'resource-plan.json'))));
const ports = resources.flatMap((plan) => Object.values(plan.ports));
assert.equal(new Set(ports).size, ports.length);
assert(resources.every((plan) => plan.external_status === 'WAITING_EXTERNAL'));

const concurrentReplay = await Promise.all(Array.from(
  { length: 5 },
  () => new FileNodeProvisioningEngine(root).provision(requests[0]),
));
assert(concurrentReplay.every((result) => result.receipt.candidate_bundle_digest === results[0].receipt.candidate_bundle_digest));
assert.equal(concurrentReplay[0].ledger.step_receipts.length, AUTONODE_PROVISIONING_STEPS.length);

const firstBefore = await directoryDigest(results[0].nodeDirectory);
const thirdBefore = await directoryDigest(results[2].nodeDirectory);
const rollback = await engine.rollback(requests[1], 'SFL-17 candidate isolation proof');
assert.equal(await directoryDigest(results[0].nodeDirectory), firstBefore);
assert.equal(await directoryDigest(results[2].nodeDirectory), thirdBefore);

const evidence = Object.freeze({
  schema_version: 'sfl.autonode-candidate-evidence.v1',
  generated_at: new Date().toISOString(),
  candidate_root: root,
  production_status: 'PENDING_STABLE_BASELINE',
  artifact: {
    source_sha: artifact.source_sha,
    build_id: artifact.build_id,
    build_count: 1,
    immutable_artifact_digest: artifact.immutable_artifact_digest,
  },
  nodes: results.map((result) => ({
    provisioning_request_id: result.ledger.provisioning_request_id,
    node_id: result.manifest.node_id,
    parent_node_id: result.manifest.parent_node_id,
    manifest_id: result.manifest.manifest_id,
    manifest_digest: result.manifest.manifest_digest,
    realm_ref: result.manifest.realm_ref.ref,
    data_scope_ref: result.manifest.data_scope_ref.ref,
    resource_binding_set_ref: result.manifest.resource_binding_set_ref.ref,
    runtime_instance_id: result.manifest.runtime_instance_id,
    candidate_bundle_digest: result.receipt.candidate_bundle_digest,
    external_status: result.receipt.external_status,
  })),
  idempotency: {
    concurrent_replays: concurrentReplay.length,
    logical_result_count: new Set(concurrentReplay.map((result) => result.receipt.candidate_bundle_digest)).size,
    step_receipt_count: concurrentReplay[0].ledger.step_receipts.length,
  },
  rollback: {
    target_node_id: rollback.node_id,
    target_receipt: `state/receipts/${createHash('sha256').update(requests[1].idempotency_key).digest('hex')}-rollback.json`,
    first_node_unchanged: true,
    third_node_unchanged: true,
  },
  source_tree: {
    copied_source_trees: 0,
    node_specific_builds: 0,
    generated_candidate_directories: results.length,
  },
  conformance: {
    'SFL-17': { candidate: 'PASS', production: 'PENDING_STABLE_BASELINE' },
    'SFL-18': { candidate: 'PASS', production: 'PENDING_STABLE_BASELINE' },
  },
});
await writeFile(join(root, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' });
process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);

function artifactFromConsole(value) {
  assert.equal(value.schema_version, 'sfl.console-artifact.v1');
  assert.equal(value.build_count, 1);
  return Object.freeze({
    source_sha: value.source_sha,
    build_id: value.build_id,
    build_count: 1,
    immutable_artifact_digest: value.immutable_artifact_digest,
    source_tree: value.source_tree,
    client_version: value.client_version,
  });
}

async function materializeSingleArtifact(directory) {
  const payload = Buffer.from('one immutable AutoNode candidate artifact\n');
  await writeFile(join(directory, 'immutable-artifact.bin'), payload, { flag: 'wx' });
  const digest = createHash('sha256').update(payload).digest('hex');
  const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  return Object.freeze({
    source_sha: sourceSha,
    build_id: `autonode-candidate-${digest.slice(0, 12)}`,
    build_count: 1,
    immutable_artifact_digest: `sha256:${digest}`,
    source_tree: 'clean',
    client_version: '1.8.0-candidate',
  });
}

function requestFor(index, artifact) {
  const token = createHash('sha256').update(`${artifact.source_sha}:L1:${index}`).digest('hex').slice(0, 10);
  const slug = `node-${token}`;
  return Object.freeze({
    schema_version: AUTONODE_REQUEST_SCHEMA_VERSION,
    provisioning_request_id: `provisioning:${token}`,
    idempotency_key: `candidate-key:${token}`,
    created_at: new Date(Date.UTC(2026, 8, 9, index)).toISOString(),
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
      code: `AUTO_${token.toUpperCase()}`,
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
        mode: 'OWN',
        source_binding_ref: `payment-config:${slug}`,
      },
    },
  });
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function directoryDigest(directory) {
  const inventory = await inventoryOf(directory, directory);
  return createHash('sha256').update(JSON.stringify(inventory)).digest('hex');
}

async function inventoryOf(directory, root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await inventoryOf(path, root));
    if (entry.isFile()) files.push({
      path: path.slice(root.length + 1),
      digest: createHash('sha256').update(await readFile(path)).digest('hex'),
    });
  }
  return files;
}
