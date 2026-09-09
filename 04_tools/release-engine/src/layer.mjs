import { lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';

import { dependencyLayerEvidence } from './artifact.mjs';
import { invariant } from './errors.mjs';
import { acquireLocks } from './lock.mjs';
import { runCommand } from './runner.mjs';
import { statePaths } from './state.mjs';

export async function layerCommand(adapter, options) {
  const targetId = options.target;
  invariant(Boolean(targetId && adapter.targets[targetId]), 'LAYER_TARGET_REQUIRED', 'Layer requires a known --target');
  const layer = await dependencyLayerEvidence(adapter, adapter.targets[targetId].dependencyLayer);
  invariant(Boolean(layer), 'LAYER_NOT_CONFIGURED', `${targetId} does not use a dependency layer`);
  const source = resolve(options.sourceNodeModules ?? join(adapter.projectRoot, 'node_modules'));
  invariant(isAbsolute(source) && (await lstat(source)).isDirectory(), 'LAYER_SOURCE_INVALID', 'Dependency source must be a node_modules directory');
  const root = resolve(options.destination ?? layer.productionRoot ?? join(statePaths(adapter).root, 'layers'));
  invariant(isAbsolute(root) && root !== '/', 'LAYER_DESTINATION_INVALID', 'Dependency layer destination must be an absolute non-root path');
  const destination = join(root, layer.digest.slice(7));
  const lockRoot = options.destination ? join(dirname(root), '.ai-delivery-layer-locks') : join(statePaths(adapter).locks, 'layers');
  const release = await acquireLocks([join(lockRoot, `${layer.digest.slice(7)}.lock`)], { project: adapter.project, phase: 'dependency-layer', target: targetId });
  const started = performance.now();
  try {
    const existing = await layerManifest(destination);
    if (existing) {
      invariant(existing.digest === layer.digest && existing.runtime === layer.runtime, 'LAYER_EXISTING_MISMATCH', `Existing dependency layer does not match ${layer.digest}`);
      return { schema: 'ai.delivery.dependency-layer-result.v1', project: adapter.project, target: targetId, destination, reused: true, digest: layer.digest, timings: { total: Math.round(performance.now() - started) } };
    }
    await mkdir(root, { recursive: true });
    const temporary = join(root, `.building-${layer.digest.slice(7)}-${process.pid}`);
    await rm(temporary, { recursive: true, force: true });
    await mkdir(temporary, { recursive: true });
    try {
      const copied = await runCommand({ name: 'dependency-layer-copy', argv: ['cp', '-a', '-l', source, join(temporary, 'node_modules')], timeoutMs: 20 * 60_000 }, {
        projectRoot: adapter.projectRoot,
        environment: {},
        changedFiles: [],
        logPath: join(statePaths(adapter).root, 'logs', `layer-${layer.digest.slice(7)}.log`),
      });
      const manifest = {
        schema: 'ai.delivery.dependency-layer.v1',
        project: adapter.project,
        target: targetId,
        digest: layer.digest,
        runtime: layer.runtime,
        keyFiles: layer.keyFiles,
        copiedFrom: source,
        createdAt: new Date().toISOString(),
        copyDurationMs: copied.durationMs,
      };
      await writeFile(join(temporary, 'AI_DELIVERY_LAYER.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o444 });
      await rename(temporary, destination);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
    return { schema: 'ai.delivery.dependency-layer-result.v1', project: adapter.project, target: targetId, destination, reused: false, digest: layer.digest, timings: { total: Math.round(performance.now() - started) } };
  } finally {
    await release();
  }
}

async function layerManifest(directory) {
  try {
    return JSON.parse(await readFile(join(directory, 'AI_DELIVERY_LAYER.json'), 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}
