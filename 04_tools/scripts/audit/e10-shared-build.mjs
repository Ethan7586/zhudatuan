#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { build } from 'esbuild';

import { workspaceResolver } from '../../release-engine/adapters/zdt-next/workspace-resolver.mjs';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const [outputArgument, sourceSha] = process.argv.slice(2);
if (!outputArgument) throw new Error('E10_BUILD_OUTPUT_REQUIRED');
if (!/^[a-f0-9]{40}$/.test(sourceSha ?? '')) throw new Error('E10_BUILD_SOURCE_SHA_INVALID');
const outputRoot = resolve(repositoryRoot, outputArgument);
const markerSource = join(repositoryRoot, '04_tools', 'scripts', 'audit', 'e10-shared-marker.txt');
const marker = (await readFile(markerSource, 'utf8')).trim();
if (!/^e10-shared-marker-v1-[AB]$/.test(marker)) throw new Error('E10_BUILD_MARKER_INVALID');
const builtAt = new Date().toISOString();
const buildId = `e10:${sourceSha}:${builtAt}`;

await mkdir(outputRoot, { recursive: true });
await run('node', [
  '04_tools/scripts/release/build-runtime-bundle.mjs',
  'identity-api',
  join(outputRoot, 'runtime'),
  sourceSha,
]);
await mkdir(join(outputRoot, 'probe'), { recursive: true });
await build({
  banner: { js: "import { createRequire as __sflCreateRequire } from 'node:module'; const require = __sflCreateRequire(import.meta.url);" },
  bundle: true,
  entryPoints: [join(repositoryRoot, '04_tools', 'scripts', 'audit', 'e10-feature-probe-runtime.ts')],
  format: 'esm',
  outfile: join(outputRoot, 'probe', 'server.mjs'),
  packages: 'bundle',
  platform: 'node',
  plugins: [await workspaceResolver(repositoryRoot)],
  sourcemap: false,
});
await copy(markerSource, join(outputRoot, 'shared-marker.txt'));
await writeFile(join(outputRoot, 'release-version.json'), `${JSON.stringify({
  schema_version: 'e10-release-version-v1',
  release: 'B',
  source_sha: sourceSha,
  build_id: buildId,
  built_at: builtAt,
})}\n`);
process.stdout.write(`E10 shared candidate built: ${sourceSha}\n`);

async function copy(source, destination) {
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

async function run(command, args) {
  await new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd: repositoryRoot, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolveRun();
      else reject(new Error(`E10_BUILD_COMMAND_FAILED:${command}:${code ?? signal}`));
    });
  });
}
