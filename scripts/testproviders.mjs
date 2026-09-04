import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { repositoryRoot } from './lib/RepositoryRoot.mjs';

const catalog = parse(await readFile(`${repositoryRoot}/config/providers.yml`, 'utf8'));
const providers = Array.isArray(catalog?.providers) ? catalog.providers : [];
if (providers.length !== 11) throw new Error(`PROVIDER_TEST_CATALOG_INVALID:expected=11 actual=${providers.length}`);
if (providers.some((provider) => typeof provider?.id !== 'string' || typeof provider?.package !== 'string')) throw new Error('PROVIDER_TEST_CATALOG_INVALID');

const results = new Array(providers.length);
let next = 0;
const concurrency = Math.max(1, Math.min(4, availableParallelism(), providers.length));
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (next < providers.length) {
    const index = next;
    next += 1;
    results[index] = await test(providers[index]);
  }
}));

const failures = results.filter(({ code }) => code !== 0);
for (const result of failures) process.stderr.write(`\n[${result.id}]\n${result.output}`);
if (failures.length) throw new Error(`PROVIDER_CONTRACT_TEST_FAILED:${failures.map(({ id }) => id).join(',')}`);
console.log(`provider contracts passed: providers=${results.length} concurrency=${concurrency}`);

function test(provider) {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['test', '--workspace', provider.package, '--', '--run'], {
      cwd: repositoryRoot,
      env: { ...process.env, APP_ENV: 'test', PROVIDER_NETWORK_ACCESS: 'disabled' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.once('error', reject);
    child.once('close', (code) => resolve({ id: provider.id, code: code ?? 1, output }));
  });
}
