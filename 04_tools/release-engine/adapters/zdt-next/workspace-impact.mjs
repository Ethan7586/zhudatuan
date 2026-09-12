import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function resolveImpact({ adapter, changes, refs }) {
  const graph = await readWorkspaceGraph(adapter.projectRoot);
  const changed = new Set();
  for (const path of changes.flatMap((change) => [change.path, change.sourcePath].filter(Boolean))) {
    if (isValidationOnly(path)) continue;
    const workspace = [...graph.byDirectory.entries()]
      .sort(([left], [right]) => right.length - left.length)
      .find(([directory]) => path === directory || path.startsWith(`${directory}/`));
    if (workspace) changed.add(workspace[1]);
  }
  if (changes.some((change) => change.path === 'package-lock.json' || change.sourcePath === 'package-lock.json')) {
    for (const workspace of await changedLockWorkspaces(adapter.projectRoot, refs, graph)) changed.add(workspace);
  }
  if (changes.some((change) => change.path === 'package.json' || change.sourcePath === 'package.json')) {
    return upperBound(adapter, 'root workspace definition changed');
  }
  if (changed.size === 0) return { targets: [], reasons: ['workspace changes are validation-only'] };

  const consumers = new Set(changed);
  let grew = true;
  while (grew) {
    grew = false;
    for (const [name, dependencies] of graph.dependencies) {
      if (!consumers.has(name) && [...dependencies].some((dependency) => consumers.has(dependency))) {
        consumers.add(name); grew = true;
      }
    }
  }
  const targets = Object.entries(adapter.targets)
    .filter(([, target]) => target.workspace && consumers.has(target.workspace))
    .map(([target]) => target).sort();
  if (targets.length === 0) return upperBound(adapter, `workspace graph has no mapped runtime for ${[...changed].sort().join(', ')}`);
  return { targets, reasons: [`workspace dependency graph selects ${targets.join(', ')}`] };
}

async function readWorkspaceGraph(projectRoot) {
  const root = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'));
  const lock = JSON.parse(await readFile(join(projectRoot, 'package-lock.json'), 'utf8'));
  const byDirectory = new Map(), dependencies = new Map();
  for (const [directory, value] of Object.entries(lock.packages ?? {})) {
    if (!directory || directory.includes('node_modules') || !value.name) continue;
    byDirectory.set(directory, value.name);
    dependencies.set(value.name, new Set(Object.keys({ ...value.dependencies, ...value.optionalDependencies, ...value.peerDependencies })));
  }
  return { root, lock, byDirectory, dependencies };
}

async function changedLockWorkspaces(projectRoot, refs, graph) {
  let before;
  try {
    const result = await execFileAsync('git', ['show', `${refs.fromSha}:package-lock.json`], { cwd: projectRoot, maxBuffer: 50 * 1024 * 1024 });
    before = JSON.parse(result.stdout);
  } catch {
    return new Set(graph.byDirectory.values());
  }
  const changed = new Set();
  for (const [directory, name] of graph.byDirectory) {
    const previous = before.packages?.[directory];
    const current = graph.lock.packages?.[directory];
    if (JSON.stringify(relevantDependencies(previous)) !== JSON.stringify(relevantDependencies(current))) changed.add(name);
  }
  return changed;
}

function relevantDependencies(value = {}) {
  return Object.fromEntries(Object.entries({ ...value.dependencies, ...value.optionalDependencies, ...value.peerDependencies }).sort());
}

function upperBound(adapter, reason) {
  return { targets: Object.entries(adapter.targets).filter(([, target]) => target.kind !== 'migration' && target.unknownImpact !== false).map(([target]) => target).sort(), reasons: [`${reason}; selected reachable runtime target upper bound`] };
}

function isValidationOnly(path) {
  return path.includes('/06_tests_ceshi/') || path.includes('/__tests__/') || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path) || /(?:^|\/)docs?(?:\/|$)/.test(path);
}
