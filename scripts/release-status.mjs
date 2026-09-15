#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { evaluateAuthoritativeDeliveryStatus, formatDeliveryStatusHuman } from '../04_tools/release-engine/src/delivery-status.mjs';
import { findSealLifecycleState, ossClientFromEnvironment } from '../04_tools/release-engine/src/oss.mjs';
import { createReleaseWriterLeaseStore } from '../04_tools/release-engine/src/release-writer-lease.mjs';

const [target, sourceSha, physicalNode, outputMode] = process.argv.slice(2);
if (!target || !sourceSha || !physicalNode || !/^[0-9a-f]{40}$/.test(sourceSha)
  || (outputMode !== undefined && outputMode !== '--json')) {
  process.stderr.write('Usage: scripts/release-status.mjs <target> <full-source-sha> <physical-node> [--json]\n');
  process.exit(64);
}

const root = resolve(import.meta.dirname, '..');
const adapter = JSON.parse(readFileSync(resolve(root, '02_platform_pingtai/infrastructure/release/zdt-next.release.json'), 'utf8'));
const deployment = adapter.targets?.[target] && adapter.nodes?.[physicalNode]?.deployments?.[target];
if (!deployment || deployment.hostedBy && deployment.hostedBy !== physicalNode) {
  process.stderr.write(`Status stopped: no physical channel for ${physicalNode}/${target}.\n`);
  process.exit(64);
}

let sealLifecycle;
let writer = null;
try {
  const client = ossClientFromEnvironment();
  sealLifecycle = { availability: 'AVAILABLE', ...(await findSealLifecycleState(adapter, { sourceSha, target, node: physicalNode }, { client })) };
  writer = await createReleaseWriterLeaseStore(client, {
    project: adapter.project, physicalNode, releaseTarget: target,
  }).read();
} catch (error) {
  sealLifecycle = { availability: 'UNAVAILABLE', state: null, key: null, paths: null, error: error.code ?? error.message };
}

const transport = adapter.nodes?.[physicalNode]?.transport ?? adapter.transport;
const host = process.env[transport.hostEnv ?? 'AI_DELIVERY_SSH_HOST'] ?? transport.host;
const agent = transport.agent ?? '/usr/local/lib/ai-delivery/agent.mjs';
const remoteCommand = command('ssh', [host, agent, 'status', '--project', adapter.project, '--node', physicalNode, '--target', target]);
let remote;
if (remoteCommand.status === 0) {
  try {
    const envelope = JSON.parse(remoteCommand.stdout);
    remote = envelope.ok === true
      ? { availability: 'AVAILABLE', ...envelope.result }
      : { availability: 'UNAVAILABLE', error: envelope.error?.code ?? 'REMOTE_STATUS_FAILED' };
  } catch {
    remote = { availability: 'UNAVAILABLE', error: 'REMOTE_STATUS_INVALID' };
  }
} else {
  remote = { availability: 'UNAVAILABLE', error: 'REMOTE_STATUS_UNAVAILABLE' };
}

const latestAction = auxiliaryAction();
const result = evaluateAuthoritativeDeliveryStatus({ sourceSha, target, physicalNode, sealLifecycle, writer, remote, latestAction });
if (outputMode === '--json') process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
else process.stdout.write(formatDeliveryStatusHuman(result));

function auxiliaryAction() {
  const listed = command('gh', ['run', 'list', '--workflow', 'delivery-1-4-3.yml', '--branch', 'zdt-next',
    '--event', 'workflow_dispatch', '--limit', '100', '--json', 'displayTitle,url,createdAt']);
  if (listed.status !== 0) return null;
  try {
    return JSON.parse(listed.stdout).find((run) => run.displayTitle?.includes(sourceSha)
      && run.displayTitle?.includes(target) && run.displayTitle?.includes(physicalNode)) ?? null;
  } catch {
    return null;
  }
}

function command(executable, arguments_) {
  const result = spawnSync(executable, arguments_, { cwd: root, encoding: 'utf8' });
  return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}
