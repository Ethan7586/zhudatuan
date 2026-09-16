import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';

import { serviceEntryDirectory, serviceTargets } from './service-targets.mjs';
export async function resolveImpact({ adapter, changes }) {
  const workspaces = await workspaceIndex(adapter.projectRoot);
  const graphs = await Promise.all(
    Object.entries(serviceTargets).map(async ([target, names]) => [
      target,
      await sourceClosure(
        adapter.projectRoot,
        names.map((name) => resolve(adapter.projectRoot, serviceEntryDirectory, `${name}.ts`)),
        workspaces
      ),
    ])
  );
  const changed = new Set(changes
    .flatMap((change) => [change.path, change.sourcePath].filter(Boolean))
    .filter((path) => !isTestFile(path)));
  const impacted = new Set();
  const found = new Set();
  for (const [target, inputs] of graphs) {
    for (const normalized of inputs) {
      if (changed.has(normalized)) {
        found.add(normalized);
        impacted.add(target);
      }
    }
  }
  const unresolved = [...changed].filter((path) => !found.has(path));
  if (impacted.size > 0) {
    const targets = [...impacted].sort();
    const selection = targets.length === 1
      ? `dependency graph selects only ${targets[0]}`
      : `dependency graph selects ${targets.join(', ')}`;
    const reason = unresolved.length === 0
      ? selection
      : `${selection}; ${unresolved.length} changed file(s) are outside production entry graphs`;
    return { targets, reasons: [reason] };
  }
  if (changed.size === 0) return { targets: [], reasons: ['changed commerce files are validation-only'] };
  return {
    targets: Object.keys(serviceTargets).sort(),
    reasons: [unresolved.length > 0
      ? `dependency graph could not narrow ${unresolved.join(', ')}; selected every reachable commerce runtime target`
      : 'dependency graph could not narrow the runtime consumer; selected every reachable commerce runtime target'],
  };
}

async function sourceClosure(projectRoot, entries, workspaces) {
  const pending = [...entries];
  const visited = new Set();
  while (pending.length > 0) {
    const file = pending.pop();
    if (!file || visited.has(file)) continue;
    visited.add(file);
    let source;
    try {
      source = await readFile(file, 'utf8');
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
    for (const specifier of importSpecifiers(source)) {
      const resolved = await resolveImport(file, specifier, workspaces);
      if (resolved) pending.push(resolved);
    }
  }
  return new Set([...visited].map((file) => relative(projectRoot, file).replaceAll('\\', '/')));
}

function importSpecifiers(source) {
  const values = new Set();
  const expression = /(?:\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?|\b(?:import|require)\s*\()\s*['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(expression)) values.add(match[1]);
  return values;
}

async function resolveImport(importer, specifier, workspaces) {
  if (specifier.startsWith('.')) return resolveSource(resolve(dirname(importer), specifier));
  const name = workspaces.names.find((candidate) => specifier === candidate || specifier.startsWith(`${candidate}/`));
  if (!name) return null;
  const workspace = workspaces.packages.get(name);
  const subpath = specifier === name ? '.' : `.${specifier.slice(name.length)}`;
  const exported = resolveExport(workspace.manifest.exports, subpath);
  return exported ? resolveSource(resolve(workspace.directory, exported)) : null;
}

async function resolveSource(base) {
  for (const candidate of [base, ...['.ts', '.tsx', '.mts', '.mjs', '.js', '.json'].map((extension) => `${base}${extension}`), ...['index.ts', 'index.tsx', 'index.mts', 'index.mjs', 'index.js'].map((name) => join(base, name))]) {
    try {
      await readFile(candidate);
      return candidate;
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'EISDIR') throw error;
    }
  }
  return null;
}

async function workspaceIndex(projectRoot) {
  const root = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'));
  const packages = new Map();
  for (const pattern of root.workspaces ?? []) {
    for (const directory of await expandWorkspacePattern(projectRoot, pattern)) {
      try {
        const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
        if (manifest.name) packages.set(manifest.name, { directory, manifest });
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }
  }
  return { packages, names: [...packages.keys()].sort((left, right) => right.length - left.length) };
}

async function expandWorkspacePattern(projectRoot, pattern) {
  const star = pattern.indexOf('*');
  if (star < 0) return [resolve(projectRoot, pattern)];
  const parent = resolve(projectRoot, pattern.slice(0, star));
  const suffix = pattern.slice(star + 1).replace(/^\//, '');
  const entries = await readdir(parent, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => (suffix ? join(parent, entry.name, suffix) : join(parent, entry.name)));
}

function resolveExport(exports, subpath) {
  if (typeof exports === 'string') return subpath === '.' ? exports : null;
  const value = exports?.[subpath] ?? (subpath === '.' && !Object.keys(exports ?? {}).some((key) => key.startsWith('.')) ? exports : null);
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((item) => resolveExportValue(item)).find(Boolean) ?? null;
  return resolveExportValue(value);
}

function resolveExportValue(value) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return null;
  return resolveExportValue(value.import ?? value.default ?? value.node ?? value.require ?? Object.values(value)[0]);
}

function isTestFile(path) {
  return path.includes('/06_tests_ceshi/')
    || path.includes('/__tests__/')
    || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path);
}
