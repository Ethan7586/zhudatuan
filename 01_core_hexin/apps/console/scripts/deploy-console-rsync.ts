import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createConsoleStaticTransferPlan } from '../src/shared/config/ConsoleStaticTransfer';

const repositoryRoot = resolve(import.meta.dirname, '../../../..');
const dist = resolve(import.meta.dirname, '../dist');
const host = 'root@123.57.232.253';
const productionDirectory = '/opt/sfl/nodes/hbbtzn-l1/targets/console/current/static';

for (const step of createConsoleStaticTransferPlan(dist, host, productionDirectory)) {
  const transfer = spawnSync(step.command, step.args, { cwd: repositoryRoot, stdio: 'inherit' });
  if (transfer.status !== 0) throw new Error(`CONSOLE_RSYNC_FAILED:${step.label}:${transfer.status ?? 'signal'}`);
}

process.stdout.write(`${JSON.stringify({
  deployed: true,
  transferOrder: ['assets', 'entry'],
  productionDirectory,
})}\n`);
