import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createOssClient, finalizePreparedSeal, findFinalSealReceipt, inspectPreparedArtifact, publishPreparedArtifact, publishWorkflowEvidence, recoverPreparedArtifact, requireFinalSealReceipt, resolveDownloadEndpoint, resolveExactFinalSealReceipt, resolvePreparedArtifact } from '../src/oss.mjs';
import { runCommand } from '../src/runner.mjs';
import { digest, prettyStableJson, sha256 } from '../src/stable.mjs';

test('two preparations of one source produce one immutable identity and resolve without bucket enumeration', async () => {
  const fixture = await prepareFixture();
  const remote = memoryOss();
  const client = createOssClient(credentials(), { fetchImpl: remote.fetch });
  const options = publishOptions(fixture);
  const first = await publishPreparedArtifact(fixture.adapter, options, { client });
  const second = await publishPreparedArtifact(fixture.adapter, options, { client });

  assert.equal(first.cacheStatus, 'miss');
  assert.equal(second.cacheStatus, 'hit_remote');
  assert.equal(first.artifactIdentity, second.artifactIdentity);
  assert.equal(first.releaseManifest.object, second.releaseManifest.object);
  assert.equal(remote.puts, 8);
  assert.equal(remote.objects.size, 8);
  const root = `fixture/app/${fixture.sourceSha}/`;
  assert.equal(first.releaseIndex.object, `${root}release-index-r4-seal-lifecycle.json`);
  for (const object of remote.objects.keys()) {
    assert.match(object, new RegExp(`^${root}`));
    if (object !== first.releaseIndex.object && !object.includes('/seals/v1/')) assert.match(object, new RegExp(`^${root}[a-f0-9]{64}/`));
  }

  const listsBeforeResolve = remote.lists;
  const resolved = await resolvePreparedArtifact(
    fixture.adapter,
    {
      sourceSha: fixture.sourceSha,
      target: 'app',
      node: 'node-a',
    },
    { client }
  );
  assert.equal(remote.lists, listsBeforeResolve);
  assert.equal(resolved.manifest.artifact.sha256, first.artifactIdentity);
  assert.equal(resolved.manifest.buildEnvironment.node, process.version);
  assert.equal(resolved.manifest.buildEnvironment.npm, '10.9.4');
  assert.equal(resolved.manifest.dependencyCache.deployableArtifact, false);
  assert.equal(resolved.provenance.schema, 'ai.delivery.build-provenance.v1');
  assert.equal(resolved.provenance.controlPlaneSha, 'b'.repeat(40));
  assert.equal(resolved.manifest.retention.minimumRollbackReleasesPerNode, 2);
  assert.equal(JSON.parse(await readFile(options.output, 'utf8')).cacheStatus, 'hit_remote');
});

test('inspection requires the current recipe while safe resolution remains legacy-index compatible', async () => {
  const fixture = await prepareFixture();
  const remote = memoryOss();
  const client = createOssClient(credentials(), { fetchImpl: remote.fetch });
  const published = await publishPreparedArtifact(fixture.adapter, publishOptions(fixture), { client });
  const currentIndex = remote.objects.get(published.releaseIndex.object);
  const legacyIndex = published.releaseIndex.object.replace(/release-index-r4-seal-lifecycle\.json$/, 'release-index.json');
  remote.objects.set(legacyIndex, currentIndex);
  remote.objects.delete(published.releaseIndex.object);

  const options = { sourceSha: fixture.sourceSha, target: 'app', node: 'node-a' };
  assert.equal((await inspectPreparedArtifact(fixture.adapter, options, { client })).exists, false);
  assert.equal((await resolvePreparedArtifact(fixture.adapter, options, { client })).releaseIndexObject, legacyIndex);
});

test('current artifact recipe rejects unreadable runtime modes before publication', async () => {
  const fixture = await prepareFixture();
  const manifest = JSON.parse(await readFile(join(fixture.root, 'artifact', 'app.artifact.json'), 'utf8'));
  manifest.entries = [{ path: 'private.txt', type: 'file', mode: 0o600, bytes: 1, sha256: sha256('x') }];
  delete manifest.manifestDigest;
  manifest.manifestDigest = digest(manifest);
  await writeFile(join(fixture.root, 'artifact', 'app.artifact.json'), prettyStableJson(manifest));
  const packageSet = JSON.parse(await readFile(fixture.packagePath, 'utf8'));
  packageSet.artifacts[0].manifestDigest = manifest.manifestDigest;
  await writeFile(fixture.packagePath, JSON.stringify(packageSet));

  await assert.rejects(
    () => publishPreparedArtifact(fixture.adapter, publishOptions(fixture), { client: createOssClient(credentials(), { fetchImpl: memoryOss().fetch }) }),
    (error) => error.code === 'OSS_RUNTIME_MODE_INVALID'
  );
});

test('first immutable publication does not require HeadObject on absent objects', async () => {
  const fixture = await prepareFixture();
  const remote = memoryOss({ denyMissingHead: true });
  const client = createOssClient(credentials(), { fetchImpl: remote.fetch });

  const receipt = await publishPreparedArtifact(fixture.adapter, publishOptions(fixture), { client });

  assert.equal(receipt.cacheStatus, 'miss');
  assert.equal(remote.puts, 8);
});

test('prepared inspection deduplicates an exact node-eligible artifact without hiding absence', async () => {
  const fixture = await prepareFixture();
  const remote = memoryOss();
  const client = createOssClient(credentials(), { fetchImpl: remote.fetch });
  const options = { sourceSha: fixture.sourceSha, target: 'app', node: 'node-a' };
  assert.equal((await inspectPreparedArtifact(fixture.adapter, options, { client })).exists, false);
  const published = await publishPreparedArtifact(fixture.adapter, publishOptions(fixture), { client });
  const inspected = await inspectPreparedArtifact(fixture.adapter, options, { client });
  assert.equal(inspected.exists, true);
  assert.equal(inspected.artifactIdentity, published.artifactIdentity);
});

test('an existing immutable artifact can recover an UPLOADED Seal receipt without rewriting it', async () => {
  const fixture = await prepareFixture();
  fixture.adapter.nodes['node-b'].deployments.app = {};
  const remote = memoryOss();
  const client = createOssClient(credentials(), { fetchImpl: remote.fetch });
  const published = await publishPreparedArtifact(fixture.adapter, publishOptions(fixture), { client });
  const before = remote.objects.get(published.releaseIndex.object).toString('utf8');

  const recovered = await recoverPreparedArtifact(fixture.adapter, {
    sourceSha: fixture.sourceSha, target: 'app', node: 'node-a', controlSha: 'c'.repeat(40),
    requestId: 'receipt-recovery', actorRole: 'build', buildRunner: 'fixture-recovery',
  }, { client });

  assert.equal(recovered.recovered, true);
  assert.equal(recovered.cacheStatus, 'hit_remote');
  assert.equal(recovered.seal.state.status, 'UPLOADED');
  assert.deepEqual(recovered.recoveredNodes, ['node-a', 'node-b']);
  await assert.rejects(requireFinalSealReceipt(fixture.adapter, {
    sourceSha: fixture.sourceSha, target: 'app', node: 'node-b', artifactDigest: published.artifactIdentity,
    controlPlaneSha: 'c'.repeat(40),
  }, { client }), (error) => error.code === 'FINAL_SEAL_RECEIPT_MISSING' && error.details.status === 'UPLOADED');
  assert.equal(remote.objects.get(published.releaseIndex.object).toString('utf8'), before);
});

test('workflow evidence is content-addressed and immutable per run attempt', async () => {
  const fixture = await prepareFixture();
  const remote = memoryOss();
  const client = createOssClient(credentials(), { fetchImpl: remote.fetch });
  const file = join(fixture.run, 'workflow-evidence.json');
  await writeFile(file, JSON.stringify({ schema: 'ai.delivery.workflow-evidence.v1', ok: true }));
  const options = {
    file, kind: 'prepare', sourceSha: fixture.sourceSha, target: 'app',
    githubRunId: '123', githubRunAttempt: '1',
  };
  const first = await publishWorkflowEvidence(fixture.adapter, options, { client });
  const second = await publishWorkflowEvidence(fixture.adapter, options, { client });
  assert.equal(first.evidence.object, second.evidence.object);
  assert.equal(first.evidence.status, 'uploaded');
  assert.equal(second.evidence.status, 'hit_remote');
  assert.match(first.evidence.object, /workflow-evidence\/prepare\/123-1-[a-f0-9]{64}\.json$/);
});

test('OSS final Seal receipt is the reusable authority for status and deployment', async () => {
  const fixture = await prepareFixture();
  const remote = memoryOss();
  const client = createOssClient(credentials(), { fetchImpl: remote.fetch });
  const published = await publishPreparedArtifact(fixture.adapter, publishOptions(fixture), { client });
  const sealed = await finalizePreparedSeal(fixture.adapter, {
    sourceSha: fixture.sourceSha, target: 'app', node: 'node-a', artifactDigest: published.artifactIdentity,
    controlPlaneSha: 'b'.repeat(40), requestId: 'release-request', actorRole: 'release', releaseRunner: 'fixture-release',
    validationReceipt: { candidate: 'healthy', currentUnchanged: true },
  }, { client });
  assert.equal(sealed.state.status, 'SEALED');
  const required = await requireFinalSealReceipt(fixture.adapter, {
    sourceSha: fixture.sourceSha, target: 'app', node: 'node-a', artifactDigest: published.artifactIdentity,
    controlPlaneSha: 'b'.repeat(40),
  }, { client });
  assert.equal(required.receipt.schema, 'ai.delivery.final-seal.v1');
  assert.deepEqual(required.receipt.routing, {
    request_id: 'fixture-request', selected_runner_class: 'aliyun', selected_runner_name: 'fixture-build',
    lease_generation: 1, lease_expires_at: '2026-09-16T00:03:00.000Z', overflow_reason: null,
    retry_count: 0, build_host: 'aliyun-ecs-202', reused_existing_task: false,
  });
  assert.equal((await findFinalSealReceipt(fixture.adapter, {
    sourceSha: fixture.sourceSha, target: 'app', node: 'node-a',
  }, { client })).object, required.object);
  const resolvedAcrossControlPlaneUpgrade = await resolveExactFinalSealReceipt(fixture.adapter, {
    sourceSha: fixture.sourceSha, target: 'app', node: 'node-a', controlPlaneSha: 'e'.repeat(40),
  }, { client });
  assert.equal(resolvedAcrossControlPlaneUpgrade.object, required.object);
  assert.equal(resolvedAcrossControlPlaneUpgrade.key.control_plane_sha, 'b'.repeat(40));
  await assert.rejects(
    () => requireFinalSealReceipt(fixture.adapter, {
      sourceSha: fixture.sourceSha, target: 'app', node: 'node-a', artifactDigest: published.artifactIdentity,
      controlPlaneSha: 'e'.repeat(40),
    }, { client }),
    (error) => error.code === 'FINAL_SEAL_RECEIPT_MISSING'
  );
});

test('Storefront publication fails closed unless complete Linux x64 runtime evidence is present', async (t) => {
  const invalidCases = [
    ['missing', null, 'PREPARE_RUNTIME_EVIDENCE_REQUIRED'],
    ['failed', { ok: false }, 'PREPARE_RUNTIME_VERIFICATION_FAILED'],
    ['platform', { platform: 'darwin' }, 'PREPARE_RUNTIME_PLATFORM_INVALID'],
    ['architecture', { arch: 'arm64' }, 'PREPARE_RUNTIME_PLATFORM_INVALID'],
    ['node modules', { nodeModulesPresent: true }, 'PREPARE_RUNTIME_NODE_MODULES_INVALID'],
    ['dynamic route', { routes: { dynamic: null } }, 'PREPARE_RUNTIME_ROUTES_INCOMPLETE'],
    ['hashed static asset', { staticAsset: { name: 'index.css' } }, 'PREPARE_RUNTIME_STATIC_ASSET_INCOMPLETE'],
  ];
  for (const [name, override, expected] of invalidCases) {
    await t.test(name, async () => {
      const fixture = await prepareFixture('storefront');
      const remote = memoryOss();
      const client = createOssClient(credentials(), { fetchImpl: remote.fetch });
      let runtimeEvidence;
      if (override) {
        runtimeEvidence = join(fixture.run, 'runtime-evidence.json');
        await writeFile(runtimeEvidence, JSON.stringify(mergeRuntimeEvidence(validStorefrontRuntimeEvidence(), override)));
      }
      await assert.rejects(
        () => publishPreparedArtifact(fixture.adapter, publishOptions(fixture, { runtimeEvidence }), { client }),
        (error) => error.code === expected
      );
      assert.equal(remote.puts, 0);
      assert.equal(remote.objects.size, 0);
    });
  }

  const fixture = await prepareFixture('storefront');
  const runtimeEvidence = join(fixture.run, 'runtime-evidence.json');
  await writeFile(runtimeEvidence, JSON.stringify(validStorefrontRuntimeEvidence()));
  const remote = memoryOss();
  const client = createOssClient(credentials(), { fetchImpl: remote.fetch });
  const published = await publishPreparedArtifact(fixture.adapter, publishOptions(fixture, { runtimeEvidence }), { client });
  const release = JSON.parse(remote.objects.get(published.releaseManifest.object).body);
  assert.equal(release.runtimeVerification.status, 'passed');
  assert.equal(release.runtimeVerification.platform, 'linux');
  assert.equal(release.runtimeVerification.arch, 'x64');
  assert.equal(release.runtimeVerification.nodeModulesPresent, false);
  assert.equal(release.runtimeVerification.staticAsset.name, 'index-AbCdEf12.css');
});

test('resolution stops before deployment for missing, tampered, target, source, node, and archive digest mismatches', async (t) => {
  await t.test('missing artifact', async () => {
    const fixture = await prepareFixture();
    const client = createOssClient(credentials(), { fetchImpl: memoryOss().fetch });
    await assert.rejects(
      () =>
        resolvePreparedArtifact(
          fixture.adapter,
          {
            sourceSha: fixture.sourceSha,
            target: 'app',
            node: 'node-a',
          },
          { client }
        ),
      (error) => error.code === 'OSS_ARTIFACT_NOT_FOUND'
    );
  });

  for (const mismatch of ['tampered', 'target', 'source', 'node', 'archive']) {
    await t.test(mismatch, async () => {
      const fixture = await prepareFixture();
      const remote = memoryOss();
      const client = createOssClient(credentials(), { fetchImpl: remote.fetch });
      const published = await publishPreparedArtifact(fixture.adapter, publishOptions(fixture), { client });
      const originalKey = published.releaseManifest.object;
      if (mismatch === 'tampered') {
        remote.objects.get(originalKey).body = Buffer.from('tampered');
      } else if (mismatch === 'archive') {
        const release = JSON.parse(remote.objects.get(originalKey).body);
        remote.objects.get(release.artifact.object).sha256 = 'f'.repeat(64);
      } else {
        const release = JSON.parse(remote.objects.get(originalKey).body);
        if (mismatch === 'target') release.target = 'other';
        if (mismatch === 'source') release.sourceSha = 'b'.repeat(40);
        if (mismatch === 'node') release.eligibleNodes = ['node-b'];
        delete release.manifestDigest;
        release.manifestDigest = digest(release);
        const body = Buffer.from(prettyStableJson(release));
        const key = originalKey.replace(/release-manifest-[a-f0-9]{64}\.json$/, `release-manifest-${sha256(body)}.json`);
        remote.objects.delete(originalKey);
        remote.objects.set(key, { body, sha256: sha256(body), contentType: 'application/json' });
        const indexKey = published.releaseIndex.object;
        const index = JSON.parse(remote.objects.get(indexKey).body);
        index.releaseManifest = {
          object: key,
          sha256: `sha256:${sha256(body)}`,
          manifestDigest: release.manifestDigest,
        };
        delete index.indexDigest;
        index.indexDigest = digest(index);
        const indexBody = Buffer.from(prettyStableJson(index));
        remote.objects.set(indexKey, { body: indexBody, sha256: sha256(indexBody), contentType: 'application/json' });
      }
      const expected = {
        tampered: 'OSS_RELEASE_MANIFEST_HASH_MISMATCH',
        target: 'OSS_ARTIFACT_TARGET_MISMATCH',
        source: 'OSS_ARTIFACT_SOURCE_SHA_MISMATCH',
        node: 'OSS_ARTIFACT_NODE_MISMATCH',
        archive: 'OSS_ARTIFACT_DIGEST_MISMATCH',
      }[mismatch];
      await assert.rejects(
        () =>
          resolvePreparedArtifact(
            fixture.adapter,
            {
              sourceSha: fixture.sourceSha,
              target: 'app',
              node: 'node-a',
            },
            { client }
          ),
        (error) => error.code === expected
      );
    });
  }
});

test('ECS download uses the reachable public endpoint unless an internal endpoint is explicit and keeps signed input out of command evidence', async () => {
  assert.equal(resolveDownloadEndpoint('https://oss-cn-beijing.aliyuncs.com'), 'oss-cn-beijing.aliyuncs.com');
  assert.equal(resolveDownloadEndpoint('oss-cn-beijing.aliyuncs.com', 'oss-cn-beijing-internal.aliyuncs.com'), 'oss-cn-beijing-internal.aliyuncs.com');
  const secretInput = 'https://bucket.oss-cn-beijing-internal.aliyuncs.com/object?Signature=sensitive';
  const result = await runCommand(
    {
      name: 'stdin-evidence',
      argv: [process.execPath, '-e', 'process.stdin.resume();process.stdin.on("end",()=>process.stdout.write("ok"))'],
      input: secretInput,
    },
    { projectRoot: process.cwd(), environment: {}, changedFiles: [] }
  );
  assert.equal(result.inputBytes, Buffer.byteLength(secretInput));
  assert.equal(JSON.stringify(result).includes('Signature=sensitive'), false);
});

async function prepareFixture(target = 'app') {
  const root = await mkdtemp(join(tmpdir(), 'ai-delivery-oss-'));
  const run = join(root, 'run');
  const artifactRoot = join(root, 'artifact');
  await mkdir(run, { recursive: true });
  await mkdir(artifactRoot, { recursive: true });
  await writeFile(join(root, 'package-lock.json'), '{"lockfileVersion":3}\n');
  const sourceSha = 'a'.repeat(40);
  const archivePath = join(artifactRoot, `${target}.tar.gz`);
  const archive = Buffer.from('deterministic artifact');
  await writeFile(archivePath, archive);
  const entries = [];
  const runtimeUnsigned = {
    schema: 'ai.delivery.artifact.v1',
    engineVersion: 2,
    artifactId: `fixture-${target}`,
    project: 'fixture',
    target,
    targetKind: 'frontend',
    sourceSha,
    contractTransition: { mode: 'contract-pool-pending', legacyRuntimeAuthority: 'disabled', localContractAuthority: 'forbidden' },
    planDigest: digest({ plan: true }),
    treeDigest: digest(entries),
    fileCount: 0,
    entryCount: 0,
    totalBytes: 0,
    entries,
    criticalFiles: [],
    deletions: [],
    archive: { sha256: `sha256:${sha256(archive)}`, bytes: archive.byteLength },
  };
  const runtimeManifest = { ...runtimeUnsigned, manifestDigest: digest(runtimeUnsigned) };
  const manifestPath = join(artifactRoot, `${target}.artifact.json`);
  await writeFile(manifestPath, prettyStableJson(runtimeManifest));
  const plan = {
    schema: 'ai.delivery.plan.v2',
    prepare: true,
    from: { sha: '9'.repeat(40) },
    to: { sha: sourceSha },
    planDigest: runtimeUnsigned.planDigest,
    timings: { plan: 3 },
  };
  const build = {
    sourceSha,
    planDigest: plan.planDigest,
    phases: { preflight: [], tests: [{ name: 'test', argv: ['node', '--test'], exitCode: 0 }], typecheck: [], build: [] },
    timings: { tests: 4, typecheck: 0, build: 5, materialize: 1 },
  };
  const packagePath = join(run, 'package.json');
  await writeFile(join(run, 'plan.json'), JSON.stringify(plan));
  await writeFile(join(run, 'build.json'), JSON.stringify(build));
  await writeFile(
    packagePath,
    JSON.stringify({
      schema: 'ai.delivery.package-set.v1',
      project: 'fixture',
      sourceSha,
      prepare: true,
      artifacts: [{ ...runtimeManifest, archive: { ...runtimeManifest.archive, path: archivePath }, manifestPath }],
      timings: { package: 2 },
    })
  );
  const adapter = {
    project: 'fixture',
    projectRoot: root,
    targets: { [target]: { kind: 'frontend' } },
    nodes: { 'node-a': { deployments: { [target]: {} } }, 'node-b': { deployments: {} } },
  };
  return { root, run, sourceSha, target, packagePath, adapter };
}

function publishOptions(fixture, overrides = {}) {
  return {
    package: fixture.packagePath,
    sourceSha: fixture.sourceSha,
    target: fixture.target,
    node: 'node-a',
    controlSha: 'b'.repeat(40),
    requestId: 'fixture-request',
    actorRole: 'build',
    buildRunner: 'fixture-build',
    runnerClass: 'aliyun',
    leaseGeneration: '1',
    leaseExpiresAt: '2026-09-16T00:03:00.000Z',
    overflowReason: 'none',
    retryCount: '0',
    buildHost: 'aliyun-ecs-202',
    reusedExistingTask: 'false',
    npmVersion: '10.9.4',
    runnerImage: 'ubuntu24',
    repository: 'owner/repository',
    output: join(fixture.run, 'prepare-receipt.json'),
    ...overrides,
  };
}

function validStorefrontRuntimeEvidence() {
  const route = { status: 200, contentType: 'text/html; charset=utf-8', bytes: 100 };
  return {
    ok: true,
    platform: 'linux',
    arch: 'x64',
    node: 'v22.22.0',
    routes: { home: route, h5: route, dynamic: route },
    staticAsset: {
      name: 'index-AbCdEf12.css',
      miss: { status: 200, contentType: 'text/css', bytes: 40 },
      hit: { status: 304, contentType: null, bytes: 0 },
      cacheControl: 'public, max-age=31536000, immutable',
      etag: 'W/"AbCdEf12"',
    },
    nodeModulesPresent: false,
  };
}

function mergeRuntimeEvidence(base, override) {
  return {
    ...base,
    ...override,
    routes: { ...base.routes, ...override.routes },
    staticAsset: { ...base.staticAsset, ...override.staticAsset },
  };
}

function credentials() {
  return { accessKeyId: 'id', accessKeySecret: 'secret', bucket: 'bucket', endpoint: 'oss.example.test' };
}

function memoryOss({ denyList = false, denyMissingHead = false } = {}) {
  const response = (body, init = {}) => {
    const headers = new Headers(init.headers);
    headers.set('date', 'Wed, 16 Sep 2026 00:00:00 GMT');
    return new Response(body, { ...init, headers });
  };
  const state = {
    objects: new Map(),
    puts: 0,
    lists: 0,
    async fetch(url, options = {}) {
      const requestUrl = new URL(url);
      const method = options.method ?? 'GET';
      const object = decodeURIComponent(requestUrl.pathname.replace(/^\//, ''));
      if (method === 'GET' && object === '' && requestUrl.searchParams.get('list-type') === '2') {
        state.lists += 1;
        if (denyList) return response('denied', { status: 403 });
        const prefix = requestUrl.searchParams.get('prefix') ?? '';
        const keys = [...state.objects.keys()].filter((key) => key.startsWith(prefix)).sort();
        return response(`<ListBucketResult><IsTruncated>false</IsTruncated>${keys.map((key) => `<Contents><Key>${encodeURIComponent(key)}</Key></Contents>`).join('')}</ListBucketResult>`, { status: 200 });
      }
      const existing = state.objects.get(object);
      if (method === 'HEAD') {
        if (!existing) return response(null, { status: denyMissingHead ? 403 : 404 });
        return response(null, { status: 200, headers: { 'content-length': String(existing.body.byteLength), 'x-oss-meta-sha256': existing.sha256 } });
      }
      if (method === 'GET') return existing ? response(existing.body, { status: 200, headers: { 'content-length': String(existing.body.byteLength), 'x-oss-meta-sha256': existing.sha256 } }) : response('missing', { status: 404 });
      if (method === 'PUT') {
        if (existing && new Headers(options.headers).get('x-oss-forbid-overwrite') === 'true') return response('exists', { status: 409 });
        const body = Buffer.from(options.body);
        state.objects.set(object, { body, sha256: sha256(body), contentType: new Headers(options.headers).get('content-type') });
        state.puts += 1;
        return response(null, { status: 200 });
      }
      return response('unsupported', { status: 405 });
    },
  };
  return state;
}
