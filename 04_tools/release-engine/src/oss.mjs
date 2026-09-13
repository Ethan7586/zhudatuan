import { createHash, createHmac } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { resolvePackageArtifactPaths } from './artifact.mjs';
import { DeliveryError, invariant } from './errors.mjs';
import { digest, prettyStableJson, sha256 } from './stable.mjs';

const DEFAULT_PREFIX = 'ai-delivery/v1';
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SOURCE_SHA_PATTERN = /^[a-f0-9]{40}$/;
const STOREFRONT_RUNTIME_NODE = 'v22.22.0';

export async function publishPreparedArtifact(adapter, options, dependencies = {}) {
  const started = performance.now();
  const sourceSha = exactSourceSha(options.sourceSha, 'PREPARE_SOURCE_SHA_INVALID');
  const target = exactTarget(adapter, options.target, 'PREPARE_TARGET');
  const packagePath = resolve(required(options.package, 'PREPARE_PACKAGE_REQUIRED'));
  const packageSet = await resolvePackageArtifactPaths(packagePath, JSON.parse(await readFile(packagePath, 'utf8')));
  invariant(packageSet.project === adapter.project, 'PREPARE_PROJECT_MISMATCH', 'Package belongs to another project');
  invariant(packageSet.sourceSha === sourceSha, 'PREPARE_SOURCE_SHA_MISMATCH', 'Package source SHA does not match the requested source SHA');
  invariant(packageSet.prepare === true, 'PREPARE_PACKAGE_MODE_INVALID', 'Only a Prepare Artifact package can be published');
  invariant(packageSet.artifacts?.length === 1 && packageSet.artifacts[0].target === target, 'PREPARE_TARGET_SCOPE_INVALID', 'Prepare Artifact publishes exactly one target');

  const artifact = packageSet.artifacts[0];
  const archive = await readFile(artifact.archive.path);
  const archiveSha256 = sha256(archive);
  invariant(artifact.archive.sha256 === `sha256:${archiveSha256}`, 'PREPARE_ARCHIVE_HASH_MISMATCH', 'Packaged archive hash differs');
  invariant(artifact.archive.bytes === archive.byteLength, 'PREPARE_ARCHIVE_BYTES_MISMATCH', 'Packaged archive size differs');
  const runtimeManifestBody = await readFile(artifact.manifestPath);
  const runtimeManifestSha256 = sha256(runtimeManifestBody);
  const runtimeManifest = JSON.parse(runtimeManifestBody.toString('utf8'));
  validateRuntimeManifest(runtimeManifest, { project: adapter.project, target, sourceSha, artifact });

  const runDirectory = dirname(packagePath);
  const plan = JSON.parse(await readFile(resolve(runDirectory, 'plan.json'), 'utf8'));
  const build = JSON.parse(await readFile(resolve(runDirectory, 'build.json'), 'utf8'));
  invariant(plan.prepare === true && plan.to?.sha === sourceSha, 'PREPARE_PLAN_INVALID', 'Prepare plan provenance differs');
  invariant(build.sourceSha === sourceSha && build.planDigest === plan.planDigest, 'PREPARE_BUILD_INVALID', 'Prepare build provenance differs');
  const lockfileSha256 = sha256(await readFile(resolve(adapter.projectRoot, 'package-lock.json')));
  const prefix = objectPrefix(adapter.project, target, sourceSha, archiveSha256, options.prefix);
  const archiveObject = `${prefix}/artifact-${archiveSha256}.tar.gz`;
  const runtimeManifestObject = `${prefix}/artifact-manifest-${runtimeManifestSha256}.json`;
  const releaseManifestUnsigned = {
    schema: 'ai.delivery.oss-release.v1',
    protocolVersion: 1,
    project: adapter.project,
    target,
    sourceSha,
    eligibleNodes: eligibleNodes(adapter, target),
    artifact: {
      object: archiveObject,
      sha256: artifact.archive.sha256,
      bytes: artifact.archive.bytes,
      treeDigest: artifact.treeDigest,
    },
    runtimeManifest: {
      object: runtimeManifestObject,
      sha256: `sha256:${runtimeManifestSha256}`,
      bytes: runtimeManifestBody.byteLength,
      manifestDigest: artifact.manifestDigest,
    },
    buildEnvironment: {
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      npm: required(options.npmVersion ?? process.env.AI_DELIVERY_NPM_VERSION, 'PREPARE_NPM_VERSION_REQUIRED'),
      runnerImage: options.runnerImage ?? process.env.ImageOS ?? `${process.platform}-${process.arch}`,
      releaseEngine: 2,
    },
    sourceEvidence: {
      repository: options.repository ?? process.env.GITHUB_REPOSITORY ?? adapter.project,
      sourceSha,
      parentSha: plan.from?.sha ?? null,
      planDigest: plan.planDigest,
      packageLockSha256: `sha256:${lockfileSha256}`,
    },
    validations: normalizedValidations(build.phases),
    runtimeVerification: await normalizedRuntimeVerification(options.runtimeEvidence, target),
    dependencyCache: {
      role: 'build-acceleration-only',
      deployableArtifact: false,
      identityAuthority: false,
    },
    retention: {
      mode: 'immutable-no-overwrite',
      automaticDeletion: 'disabled-until-current-and-rollback-pins-are-reconciled',
      minimumRollbackReleasesPerNode: 2,
      recommendedMinimumDays: 90,
    },
  };
  const releaseManifest = { ...releaseManifestUnsigned, manifestDigest: digest(releaseManifestUnsigned) };
  const releaseManifestBody = Buffer.from(prettyStableJson(releaseManifest));
  const releaseManifestSha256 = sha256(releaseManifestBody);
  const releaseManifestObject = `${prefix}/release-manifest-${releaseManifestSha256}.json`;
  const client = dependencies.client ?? ossClientFromEnvironment(options.endpoint, dependencies);

  const publicationStarted = performance.now();
  const objects = [
    await client.putImmutable(archiveObject, archive, 'application/gzip'),
    await client.putImmutable(runtimeManifestObject, runtimeManifestBody, 'application/json'),
    await client.putImmutable(releaseManifestObject, releaseManifestBody, 'application/json'),
  ];
  const publicationMs = elapsed(publicationStarted);
  const uploadedBytes = objects.filter((item) => item.status === 'uploaded').reduce((total, item) => total + item.bytes, 0);
  const reusedBytes = objects.filter((item) => item.status === 'hit_remote').reduce((total, item) => total + item.bytes, 0);
  const receipt = {
    schema: 'ai.delivery.prepare-receipt.v1',
    project: adapter.project,
    target,
    sourceSha,
    artifactIdentity: artifact.archive.sha256,
    releaseManifest: {
      object: releaseManifestObject,
      sha256: `sha256:${releaseManifestSha256}`,
      manifestDigest: releaseManifest.manifestDigest,
    },
    objects,
    cacheStatus: objects.every((item) => item.status === 'hit_remote') ? 'hit_remote' : objects.every((item) => item.status === 'uploaded') ? 'miss' : 'partial_hit',
    timings: {
      plan: plan.timings?.plan ?? 0,
      tests: build.timings?.tests ?? 0,
      typecheck: build.timings?.typecheck ?? 0,
      build: build.timings?.build ?? 0,
      materialize: build.timings?.materialize ?? 0,
      package: packageSet.timings?.package ?? 0,
      publication: publicationMs,
      total: elapsed(started),
    },
    traffic: { artifactBytes: archive.byteLength + runtimeManifestBody.byteLength + releaseManifestBody.byteLength, uploadedBytes, reusedBytes },
    completedAt: new Date().toISOString(),
  };
  if (options.output) {
    const output = resolve(options.output);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, prettyStableJson(receipt));
  }
  return receipt;
}

export async function resolvePreparedArtifact(adapter, options, dependencies = {}) {
  const started = performance.now();
  const sourceSha = exactSourceSha(options.sourceSha, 'OSS_SOURCE_SHA_INVALID');
  const target = exactTarget(adapter, options.target, 'OSS_TARGET');
  const node = required(options.node, 'OSS_NODE_REQUIRED');
  invariant(Boolean(adapter.nodes[node]?.deployments?.[target]), 'OSS_NODE_TARGET_MISMATCH', `Unknown deployment ${node}/${target}`);
  const client = dependencies.client ?? ossClientFromEnvironment(options.endpoint, dependencies);
  const root = `${normalizePrefix(options.prefix)}/${adapter.project}/${target}/${sourceSha}/`;
  const listed = await client.listPrefix(root);
  const releaseObjects = listed.filter((object) => new RegExp(`^${escapeRegExp(root)}[a-f0-9]{64}/release-manifest-[a-f0-9]{64}\\.json$`).test(object));
  invariant(releaseObjects.length > 0, 'OSS_ARTIFACT_NOT_FOUND', `No prepared artifact exists for ${target}/${sourceSha}`);
  invariant(releaseObjects.length === 1, 'OSS_ARTIFACT_AMBIGUOUS', `More than one prepared artifact exists for ${target}/${sourceSha}`, { releaseObjects });
  const releaseManifestObject = releaseObjects[0];
  const releaseManifestBody = await client.getObject(releaseManifestObject);
  const declaredReleaseHash = releaseManifestObject.match(/release-manifest-([a-f0-9]{64})\.json$/)?.[1];
  invariant(sha256(releaseManifestBody) === declaredReleaseHash, 'OSS_RELEASE_MANIFEST_HASH_MISMATCH', 'Release manifest content hash differs');
  const manifest = JSON.parse(releaseManifestBody.toString('utf8'));
  validateReleaseManifest(manifest, { adapter, target, sourceSha, node, root });

  const runtimeManifestBody = await client.getObject(manifest.runtimeManifest.object);
  invariant(digest(runtimeManifestBody) === manifest.runtimeManifest.sha256, 'OSS_RUNTIME_MANIFEST_HASH_MISMATCH', 'Runtime manifest content hash differs');
  const runtimeManifest = JSON.parse(runtimeManifestBody.toString('utf8'));
  validateRuntimeManifest(runtimeManifest, {
    project: adapter.project,
    target,
    sourceSha,
    artifact: {
      archive: manifest.artifact,
      treeDigest: manifest.artifact.treeDigest,
      manifestDigest: manifest.runtimeManifest.manifestDigest,
    },
  });
  const archiveHead = await client.headObject(manifest.artifact.object);
  invariant(archiveHead.exists, 'OSS_ARTIFACT_NOT_FOUND', 'Prepared artifact archive is missing');
  invariant(archiveHead.bytes === manifest.artifact.bytes, 'OSS_ARTIFACT_BYTES_MISMATCH', 'Prepared artifact archive size differs');
  if (archiveHead.sha256) invariant(archiveHead.sha256 === manifest.artifact.sha256.slice(7), 'OSS_ARTIFACT_DIGEST_MISMATCH', 'Prepared artifact archive digest metadata differs');

  return {
    schema: 'ai.delivery.oss-resolution.v1',
    project: adapter.project,
    target,
    sourceSha,
    node,
    releaseManifestObject,
    manifest,
    runtimeManifest,
    timings: { artifactLookup: elapsed(started), total: elapsed(started) },
  };
}

export function ossClientFromEnvironment(endpoint, dependencies = {}) {
  const environment = dependencies.environment ?? process.env;
  return createOssClient(
    {
      accessKeyId: required(environment.ALIYUN_OSS_ACCESS_KEY_ID, 'ALIYUN_OSS_ACCESS_KEY_ID_REQUIRED'),
      accessKeySecret: required(environment.ALIYUN_OSS_ACCESS_KEY_SECRET, 'ALIYUN_OSS_ACCESS_KEY_SECRET_REQUIRED'),
      securityToken: environment.ALIYUN_OSS_SECURITY_TOKEN || null,
      bucket: required(environment.ALIYUN_OSS_BUCKET, 'ALIYUN_OSS_BUCKET_REQUIRED'),
      endpoint: endpoint ?? required(environment.ALIYUN_OSS_ENDPOINT, 'ALIYUN_OSS_ENDPOINT_REQUIRED'),
    },
    dependencies
  );
}

export function deriveInternalEndpoint(publicEndpoint, override) {
  if (override) return normalizeEndpoint(override);
  const endpoint = normalizeEndpoint(publicEndpoint);
  if (endpoint.includes('-internal.')) return endpoint;
  invariant(/\.aliyuncs\.com$/.test(endpoint), 'OSS_INTERNAL_ENDPOINT_REQUIRED', 'An OSS internal endpoint is required for ECS download');
  return endpoint.replace(/\.aliyuncs\.com$/, '-internal.aliyuncs.com');
}

export function createOssClient(configuration, dependencies = {}) {
  const auth = {
    accessKeyId: required(configuration.accessKeyId, 'OSS_ACCESS_KEY_ID_REQUIRED'),
    accessKeySecret: required(configuration.accessKeySecret, 'OSS_ACCESS_KEY_SECRET_REQUIRED'),
    securityToken: configuration.securityToken || null,
    bucket: required(configuration.bucket, 'OSS_BUCKET_REQUIRED'),
    endpoint: normalizeEndpoint(configuration.endpoint),
  };
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const now = dependencies.now ?? (() => new Date());

  return Object.freeze({
    endpoint: auth.endpoint,
    async headObject(object) {
      const response = await request('HEAD', object);
      if (response.status === 404) return { exists: false, object };
      await assertResponse(response, 'OSS_HEAD_FAILED');
      return {
        exists: true,
        object,
        bytes: Number(response.headers.get('content-length') ?? '0'),
        sha256: response.headers.get('x-oss-meta-sha256'),
      };
    },
    async getObject(object) {
      const response = await request('GET', object);
      await assertResponse(response, response.status === 404 ? 'OSS_OBJECT_NOT_FOUND' : 'OSS_GET_FAILED');
      return Buffer.from(await response.arrayBuffer());
    },
    async listPrefix(prefix) {
      const response = await request('GET', null, {
        query: { 'list-type': '2', prefix, 'max-keys': '1000', 'encoding-type': 'url' },
      });
      await assertResponse(response, 'OSS_LIST_FAILED');
      const xml = await response.text();
      invariant(!/<IsTruncated>true<\/IsTruncated>/.test(xml), 'OSS_LIST_TRUNCATED', 'Prepared artifact prefix contains too many objects');
      return [...xml.matchAll(/<Key>([^<]*)<\/Key>/g)].map((match) => decodeURIComponent(decodeXml(match[1]))).sort();
    },
    async putImmutable(object, body, contentType = 'application/octet-stream') {
      const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
      const contentSha256 = sha256(bytes);
      const contentMd5 = createHash('md5').update(bytes).digest('base64');
      const response = await request('PUT', object, {
        body: bytes,
        contentMd5,
        contentType,
        ossHeaders: {
          'x-oss-forbid-overwrite': 'true',
          'x-oss-meta-sha256': contentSha256,
        },
      });
      if (response.status === 409) {
        const existing = await this.headObject(object);
        return verifyExisting(this, existing, object, bytes, contentSha256);
      }
      await assertResponse(response, 'OSS_IMMUTABLE_PUT_FAILED');
      return { object, status: 'uploaded', bytes: bytes.byteLength, sha256: `sha256:${contentSha256}` };
    },
    signGet(object, ttlSeconds = 900) {
      invariant(Number.isInteger(ttlSeconds) && ttlSeconds >= 60 && ttlSeconds <= 3600, 'OSS_SIGNED_URL_TTL_INVALID', 'OSS signed URL TTL must be between 60 and 3600 seconds');
      const expires = Math.floor(now().getTime() / 1000) + ttlSeconds;
      const tokenQuery = auth.securityToken ? `?security-token=${auth.securityToken}` : '';
      const canonicalResource = `/${auth.bucket}/${object}${tokenQuery}`;
      const value = `GET\n\n\n${expires}\n${canonicalResource}`;
      const url = objectUrl(auth, object);
      url.searchParams.set('OSSAccessKeyId', auth.accessKeyId);
      url.searchParams.set('Expires', String(expires));
      if (auth.securityToken) url.searchParams.set('security-token', auth.securityToken);
      url.searchParams.set('Signature', signature(auth.accessKeySecret, value));
      return url.toString();
    },
  });

  async function request(method, object, options = {}) {
    const date = now().toUTCString();
    const url = object === null ? bucketUrl(auth) : objectUrl(auth, object);
    for (const [key, value] of Object.entries(options.query ?? {})) url.searchParams.set(key, value);
    const ossHeaders = {
      ...(auth.securityToken ? { 'x-oss-security-token': auth.securityToken } : {}),
      ...(options.ossHeaders ?? {}),
    };
    const headers = {
      Date: date,
      ...ossHeaders,
    };
    if (options.contentMd5) headers['Content-MD5'] = options.contentMd5;
    if (options.contentType) headers['Content-Type'] = options.contentType;
    if (options.body) headers['Content-Length'] = String(options.body.byteLength);
    const canonicalOssHeaders = Object.entries(ossHeaders)
      .map(([key, value]) => [key.toLowerCase(), String(value).trim()])
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}:${value}\n`)
      .join('');
    const canonicalResource = object === null ? `/${auth.bucket}/` : `/${auth.bucket}/${object}`;
    const value = `${method}\n${options.contentMd5 ?? ''}\n${options.contentType ?? ''}\n${date}\n${canonicalOssHeaders}${canonicalResource}`;
    headers.Authorization = `OSS ${auth.accessKeyId}:${signature(auth.accessKeySecret, value)}`;
    return fetchImpl(url, { method, headers, body: options.body });
  }
}

async function verifyExisting(client, existing, object, expectedBody, expectedSha256) {
  invariant(existing.exists, 'OSS_IMMUTABLE_RACE_LOST', 'Immutable object appeared but cannot be read', { object });
  invariant(existing.bytes === expectedBody.byteLength, 'OSS_IMMUTABLE_OBJECT_CONFLICT', 'Existing immutable object size differs', { object });
  if (existing.sha256 === expectedSha256) {
    return { object, status: 'hit_remote', bytes: expectedBody.byteLength, sha256: `sha256:${expectedSha256}` };
  }
  const actual = await client.getObject(object);
  invariant(sha256(actual) === expectedSha256, 'OSS_IMMUTABLE_OBJECT_CONFLICT', 'Existing immutable object content differs', { object });
  return { object, status: 'hit_remote', bytes: expectedBody.byteLength, sha256: `sha256:${expectedSha256}` };
}

function validateReleaseManifest(manifest, { adapter, target, sourceSha, node, root }) {
  invariant(manifest.schema === 'ai.delivery.oss-release.v1' && manifest.protocolVersion === 1, 'OSS_RELEASE_MANIFEST_SCHEMA_INVALID', 'Release manifest schema is unsupported');
  invariant(manifest.project === adapter.project, 'OSS_ARTIFACT_PROJECT_MISMATCH', 'Release manifest project differs');
  invariant(manifest.target === target, 'OSS_ARTIFACT_TARGET_MISMATCH', 'Release manifest target differs');
  invariant(manifest.sourceSha === sourceSha, 'OSS_ARTIFACT_SOURCE_SHA_MISMATCH', 'Release manifest source SHA differs');
  invariant(Array.isArray(manifest.eligibleNodes) && manifest.eligibleNodes.includes(node), 'OSS_ARTIFACT_NODE_MISMATCH', 'Release manifest does not support the requested node');
  for (const object of [manifest.artifact?.object, manifest.runtimeManifest?.object]) {
    invariant(typeof object === 'string' && object.startsWith(root), 'OSS_ARTIFACT_OBJECT_SCOPE_INVALID', 'Release object is outside its immutable prefix');
  }
  invariant(/^sha256:[a-f0-9]{64}$/.test(manifest.artifact?.sha256), 'OSS_ARTIFACT_DIGEST_INVALID', 'Release artifact digest is invalid');
  invariant(/^sha256:[a-f0-9]{64}$/.test(manifest.artifact?.treeDigest), 'OSS_TREE_DIGEST_INVALID', 'Release tree digest is invalid');
  invariant(/^sha256:[a-f0-9]{64}$/.test(manifest.runtimeManifest?.sha256), 'OSS_RUNTIME_MANIFEST_DIGEST_INVALID', 'Runtime manifest digest is invalid');
  const claimed = manifest.manifestDigest;
  const unsigned = { ...manifest };
  delete unsigned.manifestDigest;
  invariant(claimed === digest(unsigned), 'OSS_RELEASE_MANIFEST_DIGEST_MISMATCH', 'Release manifest semantic digest differs');
}

function validateRuntimeManifest(manifest, { project, target, sourceSha, artifact }) {
  invariant(manifest.schema === 'ai.delivery.artifact.v1' && manifest.engineVersion === 2, 'OSS_RUNTIME_MANIFEST_SCHEMA_INVALID', 'Runtime manifest schema is unsupported');
  invariant(manifest.project === project, 'OSS_RUNTIME_PROJECT_MISMATCH', 'Runtime manifest project differs');
  invariant(manifest.target === target, 'OSS_RUNTIME_TARGET_MISMATCH', 'Runtime manifest target differs');
  invariant(manifest.sourceSha === sourceSha, 'OSS_RUNTIME_SOURCE_SHA_MISMATCH', 'Runtime manifest source SHA differs');
  invariant(manifest.archive?.sha256 === artifact.archive.sha256, 'OSS_RUNTIME_ARCHIVE_MISMATCH', 'Runtime manifest archive digest differs');
  invariant(manifest.treeDigest === artifact.treeDigest, 'OSS_RUNTIME_TREE_MISMATCH', 'Runtime manifest tree digest differs');
  invariant(manifest.manifestDigest === artifact.manifestDigest, 'OSS_RUNTIME_MANIFEST_MISMATCH', 'Runtime manifest semantic digest differs');
  const claimed = manifest.manifestDigest;
  const unsigned = { ...manifest };
  delete unsigned.manifestDigest;
  invariant(claimed === digest(unsigned), 'OSS_RUNTIME_MANIFEST_DIGEST_MISMATCH', 'Runtime manifest semantic digest differs');
}

function normalizedValidations(phases = {}) {
  return Object.fromEntries(['preflight', 'tests', 'typecheck', 'build'].map((phase) => [phase, (phases?.[phase] ?? []).map((item) => ({ name: item.name, argv: item.argv, exitCode: item.exitCode }))]));
}

async function normalizedRuntimeVerification(path, target) {
  if (!path) {
    invariant(target !== 'storefront', 'PREPARE_RUNTIME_EVIDENCE_REQUIRED', 'Storefront publication requires Linux x64 runtime evidence');
    return { status: 'not-required' };
  }
  const evidence = JSON.parse(await readFile(resolve(path), 'utf8'));
  invariant(evidence.ok === true, 'PREPARE_RUNTIME_VERIFICATION_FAILED', 'Runtime verification did not pass');
  if (target === 'storefront') {
    invariant(evidence.platform === 'linux' && evidence.arch === 'x64' && evidence.node === STOREFRONT_RUNTIME_NODE, 'PREPARE_RUNTIME_PLATFORM_INVALID', `Storefront runtime evidence must be linux/x64/${STOREFRONT_RUNTIME_NODE}`);
    invariant(evidence.nodeModulesPresent === false, 'PREPARE_RUNTIME_NODE_MODULES_INVALID', 'Storefront runtime artifact must not contain node_modules');
    for (const route of ['home', 'h5', 'dynamic']) {
      const result = evidence.routes?.[route];
      invariant(
        result?.status === 200 && /^text\/html(?:;|$)/.test(result.contentType ?? '') && Number.isSafeInteger(result.bytes) && result.bytes > 0,
        'PREPARE_RUNTIME_ROUTES_INCOMPLETE',
        `Storefront runtime route evidence is incomplete: ${route}`
      );
    }
    const asset = evidence.staticAsset;
    invariant(
      typeof asset?.name === 'string' &&
        /-[A-Za-z0-9_-]{8,}\.(?:css|js|mjs)$/.test(asset.name) &&
        asset.miss?.status === 200 &&
        Number.isSafeInteger(asset.miss?.bytes) &&
        asset.miss.bytes > 0 &&
        asset.hit?.status === 304 &&
        asset.hit?.bytes === 0 &&
        /(?:^|,)\s*immutable(?:,|$)/i.test(asset.cacheControl ?? '') &&
        typeof asset.etag === 'string' &&
        asset.etag.length > 0,
      'PREPARE_RUNTIME_STATIC_ASSET_INCOMPLETE',
      'Storefront hashed static asset evidence is incomplete'
    );
  }
  return {
    status: 'passed',
    platform: evidence.platform,
    arch: evidence.arch,
    node: evidence.node,
    routes: evidence.routes,
    staticAsset: evidence.staticAsset ? { name: evidence.staticAsset.name, miss: evidence.staticAsset.miss, hit: evidence.staticAsset.hit, cacheControl: evidence.staticAsset.cacheControl, etag: evidence.staticAsset.etag } : null,
    nodeModulesPresent: evidence.nodeModulesPresent,
  };
}

function eligibleNodes(adapter, target) {
  return Object.entries(adapter.nodes)
    .filter(([, node]) => Boolean(node.deployments?.[target]))
    .map(([node]) => node)
    .sort();
}

function exactTarget(adapter, target, prefix) {
  const value = required(target, `${prefix}_REQUIRED`);
  invariant(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(value), `${prefix}_INVALID`, 'Target identifier is invalid');
  invariant(Boolean(adapter.targets[value]), `${prefix}_UNKNOWN`, `Unknown target ${value}`);
  return value;
}

function exactSourceSha(value, code) {
  invariant(SOURCE_SHA_PATTERN.test(value ?? ''), code, 'Source SHA must be one full lowercase Git commit SHA');
  return value;
}

function objectPrefix(project, target, sourceSha, archiveSha256, prefix) {
  invariant(SHA256_PATTERN.test(archiveSha256), 'OSS_ARCHIVE_DIGEST_INVALID', 'Archive digest is invalid');
  return `${normalizePrefix(prefix)}/${project}/${target}/${sourceSha}/${archiveSha256}`;
}

function normalizePrefix(prefix = DEFAULT_PREFIX) {
  const value = String(prefix || DEFAULT_PREFIX).replace(/^\/+|\/+$/g, '');
  invariant(value.length > 0 && !value.split('/').includes('..'), 'OSS_PREFIX_INVALID', 'OSS object prefix is invalid');
  return value;
}

function normalizeEndpoint(value) {
  return required(value, 'OSS_ENDPOINT_REQUIRED')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
}

function objectUrl(auth, object) {
  const encoded = object.split('/').map(encodeURIComponent).join('/');
  return new URL(`https://${auth.bucket}.${auth.endpoint}/${encoded}`);
}

function bucketUrl(auth) {
  return new URL(`https://${auth.bucket}.${auth.endpoint}/`);
}

function signature(secret, value) {
  return createHmac('sha1', secret).update(value).digest('base64');
}

async function assertResponse(response, code) {
  if (response.ok) return;
  const detail = (await response.text()).slice(0, 600);
  throw new DeliveryError(code, `${code}: HTTP ${response.status}`, { status: response.status, detail });
}

function decodeXml(value) {
  return value.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&apos;', "'");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function required(value, code) {
  if (value === undefined || value === null || value === '') throw new DeliveryError(code, code.replaceAll('_', ' ').toLowerCase());
  return value;
}

function elapsed(started) {
  return Math.max(0, Math.round(performance.now() - started));
}
