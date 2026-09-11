import { build } from 'esbuild';
import { relative, resolve } from 'node:path';

import { serviceEntryDirectory, serviceTargets } from './service-targets.mjs';
import { workspaceResolver } from './workspace-resolver.mjs';

export async function resolveImpact({ adapter, changes }) {
  const entryPoints = Object.fromEntries(Object.entries(serviceTargets).flatMap(([target, names]) =>
    names.map((name) => [`${target}--${name}`, resolve(adapter.projectRoot, serviceEntryDirectory, `${name}.ts`)])));
  const result = await build({
    absWorkingDir: adapter.projectRoot,
    bundle: true,
    entryPoints,
    format: 'esm',
    metafile: true,
    outdir: '.ai-delivery/impact-analysis',
    packages: 'external',
    platform: 'node',
    plugins: [await workspaceResolver(adapter.projectRoot)],
    sourcemap: false,
    write: false,
  });
  const changed = new Set(changes
    .flatMap((change) => [change.path, change.sourcePath].filter(Boolean))
    .filter((path) => !isTestFile(path)));
  const impacted = new Set();
  const found = new Set();
  for (const output of Object.values(result.metafile.outputs)) {
    if (!output.entryPoint) continue;
    const entryName = Object.entries(entryPoints).find(([, path]) => relative(adapter.projectRoot, path).replaceAll('\\', '/') === output.entryPoint)?.[0];
    const target = entryName?.split('--', 1)[0];
    if (!target) continue;
    for (const input of Object.keys(output.inputs)) {
      const normalized = input.replaceAll('\\', '/');
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
    return { lane: 'A2', targets, reasons: [reason] };
  }
  return {
    lane: 'A3',
    targets: ['core'],
    reasons: [unresolved.length > 0 ? `dependency graph unresolved: ${unresolved.join(', ')}` : `dependency graph spans ${[...impacted].sort().join(', ')}`],
  };
}

function isTestFile(path) {
  return path.includes('/06_tests_ceshi/')
    || path.includes('/__tests__/')
    || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path);
}
