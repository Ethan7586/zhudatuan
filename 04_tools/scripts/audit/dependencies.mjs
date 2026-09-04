import { builtinModules } from 'node:module';
import { relative, sep } from 'node:path';

import { createProgram, moduleReferences, productionSources, root, sourceFileMap, workspacePackages } from '../check/source.mjs';
import { report } from './report.mjs';

const packages = workspacePackages();
const sources = productionSources();
const sourceFiles = sourceFileMap(createProgram(sources));
const builtins = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)]);
const forbidden = new Set(['@google/genai', 'express', 'nodemailer']);
const violations = [];
const dependencyGraph = new Map();

for (const [name, directory] of packages) {
  const manifest = JSON.parse(await import('node:fs').then(({ readFileSync }) => readFileSync(`${directory}/package.json`, 'utf8')));
  const runtime = new Set(Object.keys(manifest.dependencies ?? {}));
  const development = new Set(Object.keys(manifest.devDependencies ?? {}));
  dependencyGraph.set(name, new Set([...runtime].filter((value) => packages.has(value))));
  for (const dependency of [...runtime, ...development]) if (forbidden.has(dependency)) violations.push({ code: 'DEPENDENCY_FORBIDDEN', location: relative(root, `${directory}/package.json`), detail: dependency });
  for (const file of sources.filter((source) => source === directory || source.startsWith(`${directory}${sep}`))) {
    const sourceFile = sourceFiles.get(file);
    if (!sourceFile) continue;
    for (const reference of moduleReferences(sourceFile, packages)) {
      if (reference.specifier.startsWith('.') || builtins.has(reference.specifier)) continue;
      const dependency = packageName(reference.specifier);
      if (dependency === name) continue;
      if (!runtime.has(dependency)) {
        const code = development.has(dependency) ? 'PRODUCTION_DEV_DEPENDENCY' : 'DEPENDENCY_UNDECLARED';
        violations.push({ code, location: `${relative(root, file)}:${reference.line}`, detail: dependency });
      }
    }
  }
}

for (const name of dependencyGraph.keys()) visit(name, []);
report('dependencies', violations);

function visit(name, stack) {
  const index = stack.indexOf(name);
  if (index >= 0) {
    violations.push({ code: 'WORKSPACE_DEPENDENCY_CYCLE', location: name, detail: [...stack.slice(index), name].join(' -> ') });
    return;
  }
  for (const dependency of dependencyGraph.get(name) ?? []) visit(dependency, [...stack, name]);
}

function packageName(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}
