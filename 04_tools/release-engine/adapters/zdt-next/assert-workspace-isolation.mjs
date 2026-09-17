#!/usr/bin/env node
import { lstat, realpath, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const projectRoot = resolve(process.cwd());
const dependencyRoot = join(projectRoot, 'node_modules');
const dependencyStats = await lstat(dependencyRoot);
if (!dependencyStats.isDirectory()) throw new Error('AI_DELIVERY_NODE_MODULES_DIRECTORY_REQUIRED');
const resolvedDependencyRoot = await realpath(dependencyRoot);
if (!(resolvedDependencyRoot === projectRoot || resolvedDependencyRoot.startsWith(`${projectRoot}/`))) {
  throw new Error(`AI_DELIVERY_WORKSPACE_DEPENDENCY_LEAK:${resolvedDependencyRoot}`);
}

for (const scope of ['@shop', '@smart-wing']) {
  const scopeRoot = join(dependencyRoot, scope);
  let names;
  try { names = await readdir(scopeRoot); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    continue;
  }
  for (const name of names) {
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
