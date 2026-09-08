import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '../..');
const source = parse(readFileSync(resolve(root, 'config/requirements.yml'), 'utf8'));
if (source.mvpPolicy?.count !== 22 || source.mvpPolicy?.release !== 'blocking') throw new Error('MVP_RELEASE_POLICY_INVALID');

const deviceEvidence = process.env.SHOP_MINIAPP_DEVICE_EVIDENCE;
if (!deviceEvidence || !existsSync(resolve(root, deviceEvidence))) throw new Error('MINIAPP_DEVICE_EVIDENCE_REQUIRED');

const tasks = [
  ['check', []],
  ['db:plan', []],
  ['db:contract', []],
  ['db:assert', []],
  ['db:privileges', []],
  ['typecheck', []],
  ['check:migrations', []],
  ['test:sql', []],
  ['test:mvp', []],
  ['test:unit', []],
  ['test:contract', []],
  ['test:integration', []],
  ['test:adapters', []],
  ['test:component', []],
  ['test:journey', []],
  ['test:security', []],
  ['test:performance', []],
  ['test:e2e', []],
  ['test:visual', []],
  ['build', []],
  ['check:bundles', []],
  ['test:miniapp-device', ['--', deviceEvidence]],
  ['audit:prod', []],
];

for (const [name, arguments_] of tasks) {
  process.stdout.write(`release gate: npm run ${name}${arguments_.length ? ` ${arguments_.join(' ')}` : ''}\n`);
  const code = await run(name, arguments_);
  if (code !== 0) process.exit(code);
}
process.stdout.write(`release gate passed: checks=${tasks.length} blockingRequirements=${source.mvpPolicy.count} deviceEvidence=${deviceEvidence}\n`);

function run(name, arguments_) {
  return new Promise((resolveRun) => {
    const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', name, ...arguments_], {
      cwd: root,
      env: { ...process.env, SHOP_RELEASE_MODE: 'production' },
      stdio: 'inherit',
    });
    child.once('error', (cause) => {
      process.stderr.write(`${cause instanceof Error ? cause.message : String(cause)}\n`);
      resolveRun(1);
    });
    child.once('exit', (code) => resolveRun(code ?? 1));
  });
}
