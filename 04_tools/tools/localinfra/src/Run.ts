import { spawn, type ChildProcess } from 'node:child_process';
import { localRuntimeEntries } from './RuntimeEntries';

const PRODUCTION_ENTRIES: Readonly<Record<string, string>> = Object.freeze({
  '04_tools/tools/localsecrets/src/Main.ts': '01_core_hexin/services/commerce/dist/LocalSecretsMain.js',
  '04_tools/tools/localkms/src/Main.ts': '01_core_hexin/services/commerce/dist/LocalKmsMain.js',
  '04_tools/tools/localobjects/src/Main.ts': '01_core_hexin/services/commerce/dist/LocalObjectsMain.js',
});

const children = localRuntimeEntries(process.env.LOCAL_RUNTIME_PROFILE).map(start);

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

function start(entry: string): ChildProcess {
  const productionEntry = PRODUCTION_ENTRIES[entry];
  const argv = process.env.NODE_ENV === 'production'
    ? [requiredProductionEntry(entry, productionEntry)]
    : ['--import', 'tsx', entry];
  return spawn(process.execPath, argv, { cwd: process.cwd(), env: process.env, stdio: 'inherit' });
}

function requiredProductionEntry(sourceEntry: string, productionEntry: string | undefined): string {
  if (productionEntry) return productionEntry;
  throw new Error(`LOCAL_RUNTIME_PRODUCTION_ENTRY_MISSING:${sourceEntry}`);
}
