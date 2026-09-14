#!/usr/bin/env node
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { automaticClosureIncludes, evaluateDeliveryStatus, parseMergeTreeConflictFiles } from '../04_tools/release-engine/src/delivery-status.mjs';

const [target, sourceSha, physicalNode, outputMode] = process.argv.slice(2);
if (!target || !sourceSha || !physicalNode || !/^[0-9a-f]{40}$/.test(sourceSha)
  || (outputMode !== undefined && outputMode !== '--json')) {
  process.stderr.write('Usage: scripts/release-status.mjs <target> <full-source-sha> <physical-node> [--json]\n');
  process.exit(64);
}

const root = resolve(import.meta.dirname, '..');
const adapter = JSON.parse(readFileSync(resolve(root, '02_platform_pingtai/infrastructure/release/zdt-next.release.json'), 'utf8'));
const deployment = adapter.targets?.[target] && adapter.nodes?.[physicalNode]?.deployments?.[target];
const channelConfigured = deployment !== undefined && (deployment.hostedBy === undefined || deployment.hostedBy === physicalNode);
const localCommit = succeeds('git', ['-C', root, 'cat-file', '-e', `${sourceSha}^{commit}`]);
const remoteCommit = localCommit && command('gh', ['api', `repos/{owner}/{repo}/commits/${sourceSha}`, '--jq', '.sha']).stdout.trim() === sourceSha;
const inMainline = localCommit && succeeds('git', ['-C', root, 'merge-base', '--is-ancestor', sourceSha, 'origin/zdt-next']);
let conflictFiles = [];
if (localCommit && !inMainline) {
  const merge = command('git', ['-C', root, 'merge-tree', '--write-tree', '--name-only', 'origin/zdt-next', sourceSha]);
  if (merge.status === 1) conflictFiles = parseMergeTreeConflictFiles(merge.stdout);
}

const workflowRuns = ghRuns('deploy-prepared-aliyun.yml');
const recognizedDeliveryVersions = ['1.3.5', '1.3.2'];
const prepareRuns = ghRuns('prepare-artifact-aliyun.yml').filter(({ displayTitle }) =>
  recognizedDeliveryVersions.some((version) =>
    displayTitle === `Prepare ${version} ${sourceSha} ${target}` || displayTitle === `Prepare ${version} ${sourceSha} ${target} [github]`));
const sealRuns = workflowRuns.filter(({ displayTitle }) => recognizedDeliveryVersions.some((version) =>
  displayTitle === `Deploy ${version} validate-candidate ${sourceSha} ${physicalNode} ${target}`));
const automaticSeal = automaticClosureSeal();
if (automaticSeal) sealRuns.unshift(automaticSeal);
const result = {
  target,
  sourceSha,
  physicalNode,
  ...evaluateDeliveryStatus({ localCommit, remoteCommit, inMainline, conflictFiles, channelConfigured, prepareRuns, sealRuns }),
};

if (outputMode === '--json') process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
else printHuman(result);

function ghRuns(workflow) {
  const listed = command('gh', ['run', 'list', '--workflow', workflow, '--branch', 'zdt-next', '--event', 'workflow_dispatch',
    '--limit', '100', '--json', 'databaseId,displayTitle,status,conclusion,url,createdAt']);
  if (listed.status !== 0) return [];
  try { return JSON.parse(listed.stdout); } catch { return []; }
}

function automaticClosureSeal() {
  const listed = command('gh', ['run', 'list', '--workflow', 'auto-prepare-artifacts.yml', '--branch', 'zdt-next', '--event', 'push',
    '--limit', '100', '--json', 'databaseId,headSha,status,conclusion,url,createdAt']);
  if (listed.status !== 0) return undefined;
  let runs;
  try { runs = JSON.parse(listed.stdout).filter((run) => run.headSha === sourceSha && run.status === 'completed'); } catch { return undefined; }
  for (const run of runs) {
    const directory = mkdtempSync(join(tmpdir(), 'zdt-automatic-closure-status-'));
    try {
      const downloaded = command('gh', ['run', 'download', String(run.databaseId), '--name', `automatic-artifact-closure-${sourceSha}`, '--dir', directory]);
      if (downloaded.status !== 0) continue;
      const closure = JSON.parse(readFileSync(join(directory, 'closure.json'), 'utf8'));
      if (automaticClosureIncludes(closure, { sourceSha, target, node: physicalNode })) return run;
    } catch {
      continue;
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
  return undefined;
}

function command(executable, arguments_) {
  const result = spawnSync(executable, arguments_, { cwd: root, encoding: 'utf8' });
  return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function succeeds(executable, arguments_) {
  return command(executable, arguments_).status === 0;
}

function printHuman(result) {
  const labels = { UNKNOWN_SOURCE: '未找到提交', LOCAL_ONLY: '仅本地提交', MERGE_CONFLICT: '主线冲突',
    AWAITING_INTEGRATION: '等待接入主线', CHANNEL_MISSING: '部署通道缺失', IN_MAINLINE: '已入主线',
    PREPARING: '正在准备制品', PREPARE_FAILED: '制品准备失败', AWAITING_SEAL: '等待封板',
    SEALING: '正在封板', SEAL_FAILED: '封板失败', DEPLOYABLE: '可以部署' };
  process.stdout.write(`交付状态：${labels[result.code] ?? result.code}\n`);
  for (const [key, label] of [['committed', '已提交'], ['inMainline', '已入主线'], ['sealed', '已封板'], ['deployable', '可部署']]) {
    process.stdout.write(`${result.states[key] ? '✓' : '·'} ${label}\n`);
  }
  if (!result.remoteCommit) process.stdout.write('· GitHub 尚不可见此提交\n');
  if (!result.channelConfigured) process.stdout.write(`· ${result.physicalNode}/${result.target} 没有物理部署通道\n`);
  if (result.conflictFiles.length > 0) {
    process.stdout.write('主线冲突文件：\n');
    for (const file of result.conflictFiles) process.stdout.write(`- ${file}\n`);
  }
  const active = result.seal ?? result.prepare;
  if (active?.url) process.stdout.write(`最近任务：${active.url}\n`);
}
