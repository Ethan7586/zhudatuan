import { spawn, type ChildProcess } from 'node:child_process';

const registrationOnly = process.env.LOCAL_RUNTIME_PROFILE === 'registration-only';
const children = (registrationOnly ? [
  'services/commerce/dist/LocalSecretsMain.js',
  'services/commerce/dist/LocalKmsMain.js',
] : [
  'tools/localsecrets/src/Main.ts',
  'tools/localkms/src/Main.ts',
  'tools/localobjects/src/Main.ts',
]).map((entry) => start(entry, registrationOnly));

let stopping = false;
for (const child of children) child.once('exit', (code, signal) => {
  if (stopping) return;
  stopping = true;
  for (const candidate of children) if (candidate !== child) candidate.kill('SIGTERM');
  process.exitCode = code ?? (signal ? 1 : 0);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => {
  stopping = true;
  for (const child of children) child.kill(signal);
});

function start(entry: string, bundled: boolean): ChildProcess {
  return spawn(process.execPath, bundled ? [entry] : ['--import', 'tsx', entry], { cwd: process.cwd(), env: process.env, stdio: 'inherit' });
}
