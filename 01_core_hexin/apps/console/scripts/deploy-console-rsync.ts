import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertConsoleDeploymentCandidate, parseConsoleVersion } from '../src/shared/config/ConsoleDeployment';

const repositoryRoot = resolve(import.meta.dirname, '../../../..');
const dist = resolve(import.meta.dirname, '../dist');
const host = 'root@123.57.232.253';
const currentLink = '/opt/zhudatuan/current';
const consoleDistSuffix = '01_core_hexin/apps/console/dist';

git(['fetch', 'origin', 'zdt-next', '--quiet']);
const candidate = parseConsoleVersion(JSON.parse(readFileSync(resolve(dist, 'console-version.json'), 'utf8')));
const latestZdtNextSha = git(['rev-parse', 'origin/zdt-next']);
const currentRelease = ssh(['readlink', '-f', currentLink]);
const currentConsoleDist = `${currentRelease}/${consoleDistSuffix}`;
const currentVersionPath = `${currentConsoleDist}/console-version.json`;
const currentBuildPath = `${currentConsoleDist}/console-build.json`;
const currentSourceSha = remoteFileExists(currentVersionPath)
  ? parseConsoleVersion(JSON.parse(ssh(['cat', currentVersionPath]))).sourceSha
  : readCurrentBuildSha(currentBuildPath);

assertConsoleDeploymentCandidate(
  candidate,
  latestZdtNextSha,
  currentSourceSha,
  (ancestor, descendant) => spawnSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], { cwd: repositoryRoot }).status === 0,
);

const transfer = spawnSync('rsync', ['--archive', '--delete', `${dist}/`, `${host}:${currentConsoleDist}/`], {
  cwd: repositoryRoot,
  stdio: 'inherit',
});
if (transfer.status !== 0) throw new Error(`CONSOLE_RSYNC_FAILED:${transfer.status ?? 'signal'}`);

process.stdout.write(`${JSON.stringify({
  deployed: true,
  sourceBranch: candidate.sourceBranch,
  sourceSha: candidate.sourceSha,
  builtAt: candidate.builtAt,
  rollbackPoint: currentRelease,
  previousSourceSha: currentSourceSha,
  productionDirectory: currentConsoleDist,
})}\n`);

function readCurrentBuildSha(path: string): string {
  const value = JSON.parse(ssh(['cat', path])) as { source_sha?: unknown };
  if (typeof value.source_sha !== 'string' || !/^[0-9a-f]{40}$/.test(value.source_sha)) {
    throw new Error('CONSOLE_PRODUCTION_SOURCE_SHA_INVALID');
  }
  return value.source_sha;
}

function remoteFileExists(path: string): boolean {
  return spawnSync('ssh', ['-o', 'BatchMode=yes', host, 'test', '-f', path]).status === 0;
}

function git(args: readonly string[]): string {
  return execFileSync('git', args, { cwd: repositoryRoot, encoding: 'utf8' }).trim();
}

function ssh(args: readonly string[]): string {
  return execFileSync('ssh', ['-o', 'BatchMode=yes', host, ...args], { encoding: 'utf8' }).trim();
}
