#!/usr/bin/env node
import { lstat, realpath, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const dependencyRoot = join(projectRoot, 'node_modules');
const dependencyStats = await lstat(dependencyRoot);
if (!dependencyStats.isDirectory()) throw new Error('AI_DELIVERY_NODE_MODULES_DIRECTORY_REQUIRED');
const resolvedDependencyRoot = await realpath(dependencyRoot);
if (!(resolvedDependencyRoot === projectRoot || resolvedDependencyRoot.startsWith(`${projectRoot}/`))) {
  throw new Error(`AI_DELIVERY_WORKSPACE_DEPENDENCY_LEAK:${resolvedDependencyRoot}`);
}

for (const scope of ['@shop', '@smart-wing']) {
  const scopeRoot = join(dependencyRoot, scope);
  for (const name of await readdir(scopeRoot)) {
    const path = join(scopeRoot, name);
    const stats = await lstat(path);
    if (!stats.isSymbolicLink()) continue;
    const resolved = await realpath(path);
    if (!(resolved === projectRoot || resolved.startsWith(`${projectRoot}/`))) {
      throw new Error(`AI_DELIVERY_WORKSPACE_PACKAGE_LEAK:${scope}/${name}:${resolved}`);
    }
  }
}

process.stdout.write(`WORKSPACE_ISOLATED ${projectRoot}\n`);
