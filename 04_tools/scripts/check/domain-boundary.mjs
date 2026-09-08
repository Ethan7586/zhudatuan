import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { IDENTITY_NODE_MANIFEST } from '../../../01_core_hexin/packages/config/src/IdentityNodeManifest.ts';
import {
  materializeNodeManifestRegistryDeclaration,
  parseNodeManifest,
} from '../../../01_core_hexin/packages/config/src/SflNodeKernel.ts';
import {
  SFL_NODE_MANIFEST_REGISTRY_DECLARATION,
  SFL_NODE_REGISTRY,
  nodeDomainBinding,
  nodeOriginForBinding,
} from '../../../01_core_hexin/packages/config/src/SflNodeRegistry.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

export async function verifySflNodeDomainBoundary() {
  const registry = await materializeNodeManifestRegistryDeclaration(SFL_NODE_MANIFEST_REGISTRY_DECLARATION);
  if (registry.registry_version !== '1.6.0' || registry.manifests.length !== 2) fail('SFL_PRODUCTION_NODE_SET_INVALID');
  const l0 = registry.manifests.find((manifest) => manifest.node_id === 'node:zhudatuan:l0');
  const l1 = registry.manifests.find((manifest) => manifest.node_id === 'node:hbbtzn:l1');
  if (l0 === undefined || l1 === undefined || l1.parent_node_id !== l0.node_id) fail('SFL_PRODUCTION_TOPOLOGY_INVALID');
  verifyNodeOwnership(l0, 'zhudatuan.com', 'zhudatuan');
  verifyNodeOwnership(l1, 'hbbtzn.com', 'hbbtzn');
  const l0Hosts = new Set(l0.domain_bindings.map((binding) => binding.host));
  if (l1.domain_bindings.some((binding) => l0Hosts.has(binding.host))) fail('SFL_PRODUCTION_HOST_OWNERSHIP_AMBIGUOUS');

  if ('defaultNodeId' in IDENTITY_NODE_MANIFEST) fail('SFL_IDENTITY_DEFAULT_NODE_FORBIDDEN');
  if (IDENTITY_NODE_MANIFEST.nodes.length !== registry.manifests.length) fail('SFL_IDENTITY_PROJECTION_NODE_MISMATCH');
  for (const identity of IDENTITY_NODE_MANIFEST.nodes) {
    const manifest = registry.manifests.find((candidate) => candidate.node_id === identity.nodeId);
    if (manifest === undefined || identity.realmId !== manifest.realm_ref.ref || identity.mallId !== manifest.mall_id) {
      fail('SFL_IDENTITY_PROJECTION_CONTEXT_MISMATCH', identity.nodeId);
    }
    const hosts = new Set(manifest.domain_bindings.map((binding) => binding.host));
    const origins = [identity.accountsOrigin, identity.apiOrigin, identity.consumerApiOrigin,
      identity.storefrontOrigin, ...(identity.adminOrigin === null ? [] : [identity.adminOrigin]),
      ...identity.targets.map((target) => target.returnOrigin)];
    if (origins.some((origin) => !hosts.has(new URL(origin).hostname))) {
      fail('SFL_IDENTITY_PROJECTION_CROSS_NODE_ORIGIN', identity.nodeId);
    }
    if (identity.consumerApiOrigin !== identity.apiOrigin) {
      fail('SFL_IDENTITY_PUBLIC_API_HOST_BYPASS', identity.nodeId);
    }
  }

  const fileByNode = new Map(SFL_NODE_REGISTRY.node_bindings
    .map((binding) => [binding.node_id, binding.runtime_manifest_file]));
  for (const manifest of registry.manifests) {
    const file = fileByNode.get(manifest.node_id);
    if (file === undefined) fail('SFL_RUNTIME_MANIFEST_FILE_MISSING', manifest.node_id);
    const projected = await parseNodeManifest(JSON.parse(await readFile(
      resolve(root, '02_platform_pingtai/config/node-manifests', file), 'utf8')));
    if (JSON.stringify(projected) !== JSON.stringify(manifest)) fail('SFL_RUNTIME_MANIFEST_PROJECTION_DRIFT', file);
  }

  await verifyEnvironmentProjection();
  await verifySingleTruthSource();
}

export function verifyRawRegistryNoCrossNodeFallback(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail('SFL_NODE_REGISTRY_INVALID');
  const source = value;
  if ('defaultNodeId' in source || 'default_node_id' in source) fail('SFL_DEFAULT_NODE_FORBIDDEN');
  if (!Array.isArray(source.manifests) || !Array.isArray(source.node_bindings)) fail('SFL_NODE_REGISTRY_INVALID');
  const nodes = source.manifests;
  const hosts = nodes.flatMap((node) => Array.isArray(node.domain_bindings)
    ? node.domain_bindings.map((binding) => binding.host)
    : []);
  if (hosts.some((host) => typeof host !== 'string') || new Set(hosts).size !== hosts.length) {
    fail('SFL_PRODUCTION_HOST_OWNERSHIP_AMBIGUOUS');
  }
  const nodeIds = new Set(nodes.map((node) => node.node_id));
  for (const binding of source.node_bindings) {
    if (!nodeIds.has(binding.node_id)) fail('SFL_NODE_RESOURCE_BINDING_UNKNOWN');
  }
}

function verifyNodeOwnership(manifest, rootHost, bindingNamespace) {
  if (manifest.lifecycle_status !== 'active' || manifest.node_profile !== 'operating_mall') {
    fail('SFL_PRODUCTION_NODE_NOT_ACTIVE', manifest.node_id);
  }
  if (manifest.domain_bindings.some((binding) => binding.host !== rootHost && !binding.host.endsWith(`.${rootHost}`))) {
    fail('SFL_PRODUCTION_CROSS_NODE_HOST', manifest.node_id);
  }
  const ownedReferences = [manifest.resource_binding_set_ref.ref, manifest.secret_binding_set_ref.ref,
    ...manifest.payment_binding_refs.map((binding) => binding.ref),
    ...manifest.callback_binding_refs.map((binding) => binding.ref)];
  if (ownedReferences.some((reference) => !reference.includes(bindingNamespace))) {
    fail('SFL_PRODUCTION_CROSS_NODE_RESOURCE', manifest.node_id);
  }
}

async function verifyEnvironmentProjection() {
  const environmentFiles = new Map([
    ['node:zhudatuan:l0', {
      identity: '02_platform_pingtai/infrastructure/zhudatuan/aliyun/identity-registration-api.env.example',
      purchase: '02_platform_pingtai/infrastructure/zhudatuan/aliyun/purchase-api.env.example',
      webhook: '02_platform_pingtai/infrastructure/zhudatuan/aliyun/payment-webhook-api.env.example',
      jobs: '02_platform_pingtai/infrastructure/zhudatuan/aliyun/payment-jobs.env.example',
      namespace: 'zhudatuan/nodes/l0/',
      runtimeRoot: '/opt/sfl/nodes/zhudatuan-l0',
    }],
    ['node:hbbtzn:l1', {
      identity: '02_platform_pingtai/config/node-runtime/hbbtzn-l1/identity-api.env.example',
      purchase: '02_platform_pingtai/config/node-runtime/hbbtzn-l1/purchase-api.env.example',
      webhook: '02_platform_pingtai/config/node-runtime/hbbtzn-l1/payment-webhook-api.env.example',
      jobs: '02_platform_pingtai/config/node-runtime/hbbtzn-l1/payment-jobs.env.example',
      namespace: 'hbbtzn/nodes/l1/',
      runtimeRoot: '/opt/sfl/nodes/hbbtzn-l1',
    }],
  ]);
  for (const manifest of SFL_NODE_REGISTRY.manifests) {
    const files = environmentFiles.get(manifest.node_id);
    if (!files) fail('SFL_NODE_ENVIRONMENT_BINDING_MISSING', manifest.node_id);
    const identity = await readFile(resolve(root, files.identity), 'utf8');
    const purchase = await readFile(resolve(root, files.purchase), 'utf8');
    const webhook = await readFile(resolve(root, files.webhook), 'utf8');
    const jobs = await readFile(resolve(root, files.jobs), 'utf8');
    if (/^AUTH_RETURN_TARGETS=/m.test(identity)) fail('SFL_IDENTITY_STATIC_RETURN_TARGETS_FORBIDDEN', manifest.node_id);
    verifyOrigins(identity, manifest.domain_bindings.filter((binding) => binding.surface_ref !== 'surface:api'),
      'SFL_IDENTITY_ALLOWED_ORIGINS_DRIFT', manifest.node_id);
    verifyOrigins(purchase, manifest.domain_bindings.filter((binding) => binding.surface_ref === 'surface:storefront'),
      'SFL_PURCHASE_ALLOWED_ORIGINS_DRIFT', manifest.node_id);
    if ([identity, purchase, webhook, jobs]
      .some((source) => lineValue(source, 'NODE_MANIFEST_ID') !== manifest.manifest_id)) {
      fail('SFL_NODE_ENVIRONMENT_MANIFEST_MISMATCH', manifest.node_id);
    }
    if ([identity, purchase, webhook, jobs]
      .some((source) => lineValue(source, 'NODE_MANIFEST_PATH') !== `${files.runtimeRoot}/manifest.json`
        || lineValue(source, 'NODE_RELEASE_POINTER_REF') !== `${files.runtimeRoot}/current`)) {
      fail('SFL_NODE_ENVIRONMENT_RUNTIME_REFERENCE_MISMATCH', manifest.node_id);
    }
    const identityRefs = ['DATABASE_API_CONNECTION_REF', 'SESSION_KEY_REF', 'IDENTITY_KEY_REF',
      'WECHAT_APPLICATION_CONFIG_REF', 'WECHAT_IDENTITY_CONFIG_REF'].map((key) => lineValue(identity, key));
    const purchaseRefs = ['DATABASE_API_CONNECTION_REF', 'QUOTE_KEY_REF'].map((key) => lineValue(purchase, key));
    const webhookRefs = ['DATABASE_API_CONNECTION_REF'].map((key) => lineValue(webhook, key));
    const jobRefs = ['DATABASE_JOB_CONNECTION_REF'].map((key) => lineValue(jobs, key));
    if ([...identityRefs, ...purchaseRefs, ...webhookRefs, ...jobRefs]
      .some((reference) => !reference.startsWith(files.namespace))) {
      fail('SFL_NODE_ENVIRONMENT_SECRET_CROSS_REFERENCE', manifest.node_id);
    }
    const paymentRefs = [purchase, webhook, jobs].flatMap((source) =>
      ['WECHAT_APPLICATION_CONFIG_REF', 'WECHAT_PAYMENT_CONFIG_REF'].map((key) => lineValue(source, key)));
    if (paymentRefs.some((reference) => !reference.startsWith(`${files.namespace}payment/`))) {
      fail('SFL_NODE_ENVIRONMENT_PAYMENT_CROSS_REFERENCE', manifest.node_id);
    }
  }

  for (const binding of SFL_NODE_REGISTRY.node_bindings) {
    const primary = nodeDomainBinding(binding.node_id, binding.primary_storefront_binding_ref);
    const expected = nodeOriginForBinding(binding.node_id, binding.primary_storefront_binding_ref);
    if (expected !== `https://${primary.host}`) fail('SFL_NODE_PRIMARY_STOREFRONT_DRIFT', binding.node_id);
  }
}

function verifyOrigins(source, bindings, code, nodeId) {
  const actual = lineValue(source, 'API_ALLOWED_ORIGINS').split(',').filter(Boolean).sort();
  const expected = bindings.map((binding) => `https://${binding.host}`).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(code, nodeId);
}

async function verifySingleTruthSource() {
  const forbiddenFiles = [
    '01_core_hexin/packages/config/src/identity-node-manifest.json',
    '02_platform_pingtai/config/console-node-manifests.json',
    '02_platform_pingtai/config/node-registry.json',
    '02_platform_pingtai/config/production-domain-boundary.json',
  ];
  for (const file of forbiddenFiles) {
    if (await readFile(resolve(root, file), 'utf8').then(() => true, () => false)) fail('SFL_SECOND_TRUTH_SOURCE_PRESENT', file);
  }
  const sourceRoots = [
    '01_core_hexin/apps',
    '01_core_hexin/packages',
    '01_core_hexin/services',
    '02_platform_pingtai/infrastructure',
    '04_tools/tools',
  ];
  for (const sourceRoot of sourceRoots) {
    for (const file of await sourceFiles(resolve(root, sourceRoot))) {
      const source = await readFile(file, 'utf8');
      if (/\bdefaultNodeId\b|\bdefaultIdentityNode\b/.test(source)) {
        fail('SFL_DEFAULT_NODE_FALLBACK_PRESENT', file.slice(root.length + 1));
      }
    }
  }
}

async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    else if (['.ts', '.tsx', '.mjs', '.cjs', '.json'].includes(extname(entry.name))) files.push(path);
  }
  return files;
}

function lineValue(source, key) {
  const line = source.split(/\r?\n/).find((candidate) => candidate.startsWith(`${key}=`));
  if (line === undefined) fail('SFL_IDENTITY_ENVIRONMENT_VALUE_MISSING', key);
  return line.slice(key.length + 1);
}

function fail(code, detail) {
  throw new Error(detail === undefined ? code : `${code}:${detail}`);
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await verifySflNodeDomainBoundary();
  console.log('SFL 1.6 node/domain boundary verified: one registry, two sovereign API domains, zero default fallback.');
}
