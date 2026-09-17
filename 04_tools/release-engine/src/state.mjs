import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

import { prettyStableJson } from './stable.mjs';

export function statePaths(adapter) {
  const root = resolve(adapter.projectRoot, adapter.stateDirectory);
  return {
    root,
    runs: join(root, 'runs'),
    artifacts: join(root, 'artifacts'),
  };
}

export async function createRun(adapter, plan) {
  const paths = statePaths(adapter);
  const runId = `${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${plan.to.sha.slice(0, 8)}-${randomUUID().slice(0, 8)}`;
  const directory = join(paths.runs, runId);
  await mkdir(join(directory, 'logs'), { recursive: true });
  await writeJson(join(directory, 'plan.json'), { ...plan, runId });
  return { runId, directory, paths };
}

export async function writeJson(path, value) {
  await writeFile(path, prettyStableJson(value));
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
