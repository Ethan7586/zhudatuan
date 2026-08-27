import { spawn, type ChildProcess } from 'node:child_process';

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
const profile = process.env.LOCAL_RUNTIME_PROFILE;
if (profile !== undefined && profile !== 'registration-only' && profile !== 'full-staging') {
  throw new Error('LOCAL_RUNTIME_PROFILE_INVALID');
}
const bundled = profile !== undefined;
const children = (profile === 'registration-only' ? [
  'services/commerce/dist/LocalSecretsMain.js',
  'services/commerce/dist/LocalKmsMain.js',
] : profile === 'full-staging' ? [
  'services/commerce/dist/LocalSecretsMain.js',
  'services/commerce/dist/LocalKmsMain.js',
  'services/commerce/dist/LocalObjectsMain.js',
] : [
<<<<<<< HEAD
  'tools/localsecrets/src/Main.ts',
  'tools/localkms/src/Main.ts',
  'tools/localobjects/src/Main.ts',
]).map((entry) => start(entry, bundled));
=======
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
const children = [
  'tools/localsecrets/src/Main.ts',
  'tools/localkms/src/Main.ts',
  'tools/localobjects/src/Main.ts',
].map(start);
<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  'tools/localsecrets/src/Main.ts',
  'tools/localkms/src/Main.ts',
  'tools/localobjects/src/Main.ts',
]).map((entry) => start(entry, bundled));
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)

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

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
function start(entry: string, bundled: boolean): ChildProcess {
  return spawn(process.execPath, bundled ? [entry] : ['--import', 'tsx', entry], { cwd: process.cwd(), env: process.env, stdio: 'inherit' });
=======
function start(entry: string): ChildProcess {
  return spawn(process.execPath, ['--import', 'tsx', entry], { cwd: process.cwd(), env: process.env, stdio: 'inherit' });
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
function start(entry: string, bundled: boolean): ChildProcess {
  return spawn(process.execPath, bundled ? [entry] : ['--import', 'tsx', entry], { cwd: process.cwd(), env: process.env, stdio: 'inherit' });
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
function start(entry: string): ChildProcess {
  return spawn(process.execPath, ['--import', 'tsx', entry], { cwd: process.cwd(), env: process.env, stdio: 'inherit' });
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
}
