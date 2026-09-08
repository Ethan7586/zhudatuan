import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { repositoryRoot } from './lib/RepositoryRoot.mjs';

const packages = await extensionPackages();
const commands = [
  { id: 'channel-packages', command: ['run', 'test:providers'] },
  { id: 'channel-core', command: ['test', '--workspace', '@shop/providercore'] },
  ...packages.map((name) => ({ id: name, command: ['test', '--workspace', name] })),
  {
    id: 'host-isolation',
    command: ['run', 'test', '--workspace', '@shop/commerce', '--', '--run',
      'src/composition/ExtensionRegistry.test.ts',
      'src/modules/extension/application/service/Lifecycle.test.ts',
      'src/modules/channel/test/ApplyChannelWebhook.test.ts',
      'src/modules/channel/test/ChannelModel.test.ts',
      'src/modules/fulfillment/domain/model/FulfillmentAggregate.test.ts',
      'src/modules/notification/infrastructure/registry/DeliveryRegistry.test.ts'],
  },
];

const results = new Array(commands.length);
let next = 0;
const concurrency = Math.max(1, Math.min(4, availableParallelism(), commands.length));
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (next < commands.length) {
    const index = next;
    next += 1;
    results[index] = await execute(commands[index]);
  }
}));

const failures = results.filter(({ code }) => code !== 0);
for (const failure of failures) process.stderr.write(`\n[${failure.id}]\n${failure.output}`);
if (failures.length) throw new Error(`EXTENSION_ACCEPTANCE_FAILED:${failures.map(({ id }) => id).join(',')}`);
console.log(`extension acceptance passed: suites=${results.length} packages=${packages.length + 12} concurrency=${concurrency}`);

async function extensionPackages() {
  const roots = ['extensions/notification', 'extensions/payment'];
  const values = [];
  for (const root of roots) {
    const directory = path.join(repositoryRoot, root);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const document = JSON.parse(await readFile(path.join(directory, entry.name, 'package.json'), 'utf8'));
      if (typeof document.name !== 'string' || !document.name.startsWith('@shop/')) throw new Error(`EXTENSION_PACKAGE_INVALID:${root}/${entry.name}`);
      values.push(document.name);
    }
  }
  return Object.freeze(values.sort());
}

function execute(job) {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', job.command, { cwd: repositoryRoot, env: { ...process.env, APP_ENV: 'test', PROVIDER_NETWORK_ACCESS: 'disabled' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.once('error', reject);
    child.once('close', (code) => resolve({ id: job.id, code: code ?? 1, output }));
  });
}
