import { spawn, type ChildProcess } from 'node:child_process';

const children = ['tools/localsecrets/src/Main.ts', 'tools/localkms/src/Main.ts', 'tools/localobjects/src/Main.ts'].map(start);

let stopping = false;
for (const child of children)
  child.once('exit', (code, signal) => {
    if (stopping) return;
    stopping = true;
    for (const candidate of children) if (candidate !== child) candidate.kill('SIGTERM');
    process.exitCode = code ?? (signal ? 1 : 0);
  });

for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    stopping = true;
    for (const child of children) child.kill(signal);
  });

function start(entry: string): ChildProcess {
  return spawn(process.execPath, ['--import', 'tsx', entry], { cwd: process.cwd(), env: process.env, stdio: 'inherit' });
}
