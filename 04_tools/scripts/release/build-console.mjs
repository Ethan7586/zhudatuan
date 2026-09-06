import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';

import { clientEnvironment } from '@shop/config/client';
import { loadEnv } from 'vite';
import { CONSOLE_ARTIFACT_SCHEMA, readConsoleArtifact } from './console-artifact.mjs';

const root = resolve(import.meta.dirname, '../../..');
const consoleRoot = resolve(root, '01_core_hexin/apps/console');
const output = process.argv[2] ? resolve(process.argv[2]) : undefined;
if (!output || output === root || existsSync(output)) throw new Error('CONSOLE_RELEASE_OUTPUT_MUST_NOT_EXIST');
const outputFromRoot = relative(root, output);
if (outputFromRoot !== '..' && !outputFromRoot.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && !isAbsolute(outputFromRoot)) throw new Error('CONSOLE_RELEASE_OUTPUT_INSIDE_WORKTREE');

assertCleanWorkspace();
const commit = git(['rev-parse', 'HEAD']);
if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('CONSOLE_RELEASE_COMMIT_INVALID');

const environment = {
  ...loadEnv('production', consoleRoot, ''),
  ...process.env,
  SHOP_BUILD_COMMIT: commit,
  SHOP_SOURCE_TREE: 'clean',
};
const client = clientEnvironment(environment);

const build = spawnSync(npmCommand(), ['run', 'build', '--workspace', '@shop/console'], {
  cwd: root,
  env: environment,
  stdio: 'inherit',
});
if (build.status !== 0) throw new Error(`CONSOLE_RELEASE_BUILD_FAILED:${build.status ?? 'signal'}`);
assertCleanWorkspace();

const dist = resolve(consoleRoot, 'dist');
writeFileSync(join(dist, 'console-build.json'), `${JSON.stringify({
  schema: CONSOLE_ARTIFACT_SCHEMA,
  commit,
  sourceTree: 'clean',
  apiBaseUrl: client.apiBaseUrl,
  authBaseUrl: client.authBaseUrl,
  clientVersion: client.clientVersion,
}, null, 2)}\n`, { encoding: 'utf8', mode: 0o644 });
readConsoleArtifact(dist, { expectedCommit: commit, requireClean: true });
cpSync(dist, output, { recursive: true, errorOnExist: true, dereference: true });

const verify = spawnSync(process.execPath, [resolve(import.meta.dirname, 'verify-console.mjs'), '--dist', output, '--expected-commit', commit, '--require-clean'], { cwd: root, stdio: 'inherit' });
if (verify.status !== 0) throw new Error(`CONSOLE_RELEASE_BROWSER_VERIFICATION_FAILED:${verify.status ?? 'signal'}`);

const artifact = readConsoleArtifact(output, { expectedCommit: commit, requireClean: true });
console.log(`console release artifact: ${output} commit=${commit} sha256=${artifact.sha256}`);

function assertCleanWorkspace() {
  const status = git(['status', '--porcelain', '--untracked-files=all']);
  if (status !== '') throw new Error(`CONSOLE_RELEASE_WORKTREE_DIRTY\n${status.split('\n').slice(0, 12).join('\n')}`);
}

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}
