import { spawn } from 'node:child_process';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const groups = ['check:authority', 'check:architecture', 'check:quality'];
const results = await Promise.all(groups.map(run));
const failed = results.filter(({ code }) => code !== 0);
if (failed.length > 0) {
  for (const result of failed) process.stderr.write(`local check group failed: ${result.name} exit=${result.code}\n`);
  process.exit(1);
}
process.stdout.write(`local checks passed in parallel: ${groups.join(', ')}\n`);

function run(name) {
  return new Promise((resolve) => {
    const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', name], {
      cwd: repositoryRoot,
      env: process.env,
      stdio: 'inherit',
    });
    child.once('error', (cause) => {
      process.stderr.write(`${name}: ${cause instanceof Error ? cause.message : String(cause)}\n`);
      resolve({ name, code: 1 });
    });
    child.once('exit', (code) => resolve({ name, code: code ?? 1 }));
  });
}
