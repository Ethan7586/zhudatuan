#!/usr/bin/env node

import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { createProgram, forbiddenProductionParts, moduleReferences, productionSources, relative, root, sourceFileMap, testSources, ts, workspacePackages } from './source.mjs';
import { auditDatabase } from './callgraph/database.mjs';
import { auditEvents } from './callgraph/events.mjs';
import { auditExtensions } from './callgraph/extensions.mjs';
import { auditJobs } from './callgraph/jobs.mjs';
import { auditOperations } from './callgraph/operations.mjs';
import { auditRoutes } from './callgraph/routes.mjs';
import { auditServices } from './callgraph/services.mjs';

const retiredParts = new Set(['admin-web', 'auth-web', 'commerce-api', 'core-read-cache', 'jobs', 'storefront-web', 'wechat-miniapp']);
const allowedOrphanNames = new Set(['vite-env.d.ts', 'worker-configuration.d.ts', 'env.d.ts']);
const entryNames = new Set([
  'main.ts',
  'main.tsx',
  'app.js',
  'ApiMain.ts',
  'JobsMain.ts',
  'ProviderMain.ts',
  'MigrationMain.ts',
  'SmokeMain.ts',
  'ContractGenerator.ts',
  'RequirementGenerator.ts',
  'Main.ts',
  'Prepare.ts',
  'ProviderSandbox.ts',
  'Database.ts',
  'Run.ts',
  'Verify.ts',
  'Migrate.ts',
  'Seed.ts',
  'Visual.ts',
  'Journey.ts',
  'Launch.ts',
]);
const operationPattern = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*){2,}$/;

const violation = (code, location, detail) => ({ code, location, detail });
const violationKey = (value) => `${value.code}\u0000${value.location}\u0000${value.detail}`;

function forbiddenPart(value) {
  return relative(value)
    .split('/')
    .find((part) => forbiddenProductionParts.has(part.toLowerCase()));
}

function entrypoints(sources, packages) {
  const entries = new Set();
  for (const source of sources) {
    const name = path.basename(source);
    const parts = relative(source).split('/');
    if (entryNames.has(name) || name.endsWith('.d.ts')) entries.add(source);
    if (parts[0] === 'services' && parts[2] === 'src' && parts[3] === 'entry' && name.endsWith('Main.ts')) entries.add(source);
    if (['page.tsx', 'layout.tsx', 'manifest.ts', 'route.ts'].includes(name) && parts.includes('app')) {
      entries.add(source);
    }
    if (parts[0] === 'apps' && parts[2] === 'pages' && ['.ts', '.tsx'].includes(path.extname(name))) {
      entries.add(source);
    }
    if (parts.includes('miniprogram') && (parts.includes('page') || parts.includes('component') || parts.includes('custom-tab-bar') || miniappComponentSource(source))) {
      entries.add(source);
    }
    if (parts.includes('miniprogram') && name === 'app.ts') entries.add(source);
    if (parts[0] === 'apps' && parts.includes('feature') && (name === 'Manifest.ts' || name === 'index.ts')) entries.add(source);
  }
  for (const directory of packages.values()) {
    for (const candidate of [path.join(directory, 'src/index.ts'), path.join(directory, 'src/index.tsx'), path.join(directory, 'worker/index.ts')]) {
      if (sources.has(path.resolve(candidate))) entries.add(path.resolve(candidate));
    }
    const manifest = path.join(directory, 'package.json');
    if (existsSync(manifest)) {
      const payload = JSON.parse(readFileSync(manifest, 'utf8'));
      for (const target of exportTargets(payload.exports)) {
        if (target.includes('*')) continue;
        const candidate = path.resolve(directory, target);
        if (sources.has(candidate)) entries.add(candidate);
      }
      for (const target of scriptTargets(payload.scripts)) {
        const candidate = path.resolve(directory, target);
        if (sources.has(candidate)) entries.add(candidate);
      }
    }
  }
  return entries;
}

function miniappComponentSource(source) {
  if (!['.ts', '.tsx', '.js', '.jsx'].includes(path.extname(source))) return false;
  const descriptor = source.replace(/\.(?:[jt]sx?)$/, '.json');
  if (!existsSync(descriptor)) return false;
  try {
    return JSON.parse(readFileSync(descriptor, 'utf8')).component === true;
  } catch {
    return false;
  }
}

function scriptTargets(scripts) {
  if (scripts === null || typeof scripts !== 'object' || Array.isArray(scripts)) return [];
  const targets = [];
  const sourcePattern = /(?:^|[\s"'])(\.?\.?\/?[A-Za-z0-9./-]+\.(?:[cm]?[jt]sx?))(?=$|[\s"'])/g;
  for (const command of Object.values(scripts)) {
    if (typeof command !== 'string') continue;
    for (const match of command.matchAll(sourcePattern)) targets.push(match[1]);
  }
  return targets;
}

function exportTargets(value) {
  if (typeof value === 'string') return [value];
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.values(value).flatMap(exportTargets);
}

function boundaryDetail(source, target) {
  const sourceParts = relative(source).split('/');
  const targetParts = relative(target).split('/');
  if (sourceParts[0] === 'apps' && ['services', 'database'].includes(targetParts[0])) {
    return 'client imports service or database source';
  }
  const prefix = ['services', 'commerce', 'src', 'modules'];
  if (!prefix.every((part, index) => sourceParts[index] === part && targetParts[index] === part)) {
    return undefined;
  }
  if (sourceParts.length < 7 || targetParts.length < 7) return undefined;
  const sourceModule = sourceParts[4];
  const targetModule = targetParts[4];
  const targetLayer = targetParts[5];
  if (sourceModule !== targetModule) return targetLayer === 'public' ? undefined : `cross-module internal import ${sourceModule}->${targetModule}`;
  const sourceLayer = sourceParts[5];
  const denied = {
    domain: new Set(['application', 'infrastructure', 'interface']),
    application: new Set(['infrastructure', 'interface']),
  };
  return denied[sourceLayer]?.has(targetLayer) ? `invalid layer direction ${sourceLayer}->${targetLayer}` : undefined;
}

function importCaseMismatch(source, reference) {
  if (!reference.target || !reference.specifier.startsWith('.')) return false;
  const expected = importStem(path.resolve(path.dirname(source), reference.specifier));
  const actual = importStem(reference.target);
  const candidates = path.basename(actual) === 'index' ? [actual, path.dirname(actual)] : [actual];
  return candidates.some((candidate) => candidate.toLowerCase() === expected.toLowerCase()) && !candidates.includes(expected);
}

function importStem(value) {
  return value.replace(/\.(?:[cm]?[jt]sx?)$/i, '');
}

function hasModifier(node, kind) {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === kind);
}

function addBindingNames(name, values) {
  if (ts.isIdentifier(name)) {
    values.add(name.text);
  } else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    for (const element of name.elements) if (ts.isBindingElement(element)) addBindingNames(element.name, values);
  }
}

function exportedNames(file, sourceFiles, packages, cache, visiting = new Set()) {
  if (cache.has(file)) return cache.get(file);
  if (visiting.has(file)) return new Set();
  visiting.add(file);
  const sourceFile = sourceFiles.get(file);
  const values = new Set();
  if (!sourceFile) return values;
  const references = new Map(moduleReferences(sourceFile, packages).map((reference) => [reference.node, reference]));
  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement)) {
      values.add('default');
      continue;
    }
    if (ts.isExportDeclaration(statement)) {
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) values.add(element.name.text);
      } else if (statement.exportClause && ts.isNamespaceExport(statement.exportClause)) {
        values.add(statement.exportClause.name.text);
      } else if (statement.moduleSpecifier) {
        const target = references.get(statement)?.target;
        if (target) for (const name of exportedNames(target, sourceFiles, packages, cache, visiting)) values.add(name);
      }
      continue;
    }
    if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue;
    if (hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) {
      values.add('default');
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) addBindingNames(declaration.name, values);
    } else if ('name' in statement && statement.name && ts.isIdentifier(statement.name)) {
      values.add(statement.name.text);
    }
  }
  if (/\bmodule\.exports\b|\bexports\.[A-Za-z_$]/.test(sourceFile.text)) values.add('*');
  visiting.delete(file);
  cache.set(file, values);
  return values;
}

function bindingViolations(sourceFile, reference, target, sourceFiles, packages, cache) {
  const node = reference.node;
  if (!node || (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node))) return [];
  const available = exportedNames(target, sourceFiles, packages, cache);
  if (available.has('*')) return [];
  const requested = [];
  if (ts.isImportDeclaration(node) && node.importClause) {
    if (node.importClause.name) requested.push('default');
    const bindings = node.importClause.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) requested.push((element.propertyName ?? element.name).text);
    }
  }
  if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
    for (const element of node.exportClause.elements) requested.push((element.propertyName ?? element.name).text);
  }
  return requested.filter((name) => !available.has(name)).map((name) => violation('MISSING_EXPORT', `${relative(sourceFile.fileName)}:${reference.line}`, `${name}<-${reference.specifier}`));
}

export function audit() {
  const sourceList = productionSources();
  const testList = testSources();
  const sources = new Set(sourceList);
  const tests = new Set(testList);
  const packages = workspacePackages();
  const program = createProgram([...sourceList, ...testList]);
  const sourceFiles = sourceFileMap(program);
  const graph = new Map();
  const exportCache = new Map();
  const values = [];

  for (const source of sourceList) {
    const sourceName = relative(source);
    const sourceParts = sourceName.split('/');
    const forbidden = forbiddenPart(source);
    if (forbidden) values.push(violation('FORBIDDEN_PRODUCTION_PATH', sourceName, forbidden));
    if (sourceParts.some((part) => retiredParts.has(part))) {
      values.push(violation('RETIRED_PATH_PRESENT', sourceName, 'hard-cut target required'));
    }
    const sourceFile = sourceFiles.get(source);
    if (!sourceFile) {
      values.push(violation('SOURCE_NOT_PARSED', sourceName, 'TypeScript program omitted source'));
      continue;
    }
    if (sourceFile.text.includes('@smart-wing/')) {
      values.push(violation('RETIRED_PACKAGE_IMPORT', sourceName, '@smart-wing'));
    }
    const edges = new Set();
    for (const reference of moduleReferences(sourceFile, packages)) {
      if (reference.external) continue;
      const location = `${sourceName}:${reference.line}`;
      if (!reference.target) {
        values.push(violation('UNRESOLVED_IMPORT', location, reference.specifier));
        continue;
      }
      if (importCaseMismatch(source, reference)) {
        values.push(violation('IMPORT_PATH_CASE_MISMATCH', location, reference.specifier));
      }
      if (path.extname(reference.target) === '.json') continue;
      if (tests.has(reference.target)) {
        values.push(violation('PRODUCTION_TEST_IMPORT', location, reference.specifier));
        continue;
      }
      if (!sources.has(reference.target)) {
        values.push(violation('NONPRODUCTION_IMPORT', location, reference.specifier));
        continue;
      }
      edges.add(reference.target);
      values.push(...bindingViolations(sourceFile, reference, reference.target, sourceFiles, packages, exportCache));
      if (forbiddenPart(reference.target)) {
        values.push(violation('FORBIDDEN_PRODUCTION_IMPORT', location, reference.specifier));
      }
      const detail = boundaryDetail(source, reference.target);
      if (detail) values.push(violation('BOUNDARY_VIOLATION', location, detail));
      if (reference.specifier.startsWith('@shop/') && reference.specifier.includes('/src/')) {
        values.push(violation('DEEP_PACKAGE_IMPORT', location, reference.specifier));
      }
    }
    graph.set(source, edges);
  }

  const reachable = new Set();
  const queue = [...entrypoints(sources, packages)];
  while (queue.length) {
    const current = queue.shift();
    if (reachable.has(current)) continue;
    reachable.add(current);
    for (const target of graph.get(current) ?? []) queue.push(target);
  }
  for (const source of sourceList) {
    if (!reachable.has(source) && !allowedOrphanNames.has(path.basename(source))) {
      values.push(violation('UNREACHABLE_PRODUCTION_SOURCE', relative(source), 'no entrypoint path'));
    }
  }
  for (const test of testList) {
    const sourceFile = sourceFiles.get(test);
    if (!sourceFile) continue;
    for (const reference of moduleReferences(sourceFile, packages)) {
      if (!reference.external && !reference.target) {
        values.push(violation('BROKEN_TEST_IMPORT', `${relative(test)}:${reference.line}`, reference.specifier));
      } else if (!reference.external && reference.target) {
        values.push(...bindingViolations(sourceFile, reference, reference.target, sourceFiles, packages, exportCache));
      }
    }
  }
  values.push(...auditOperations(sources, tests));
  values.push(...auditEvents(sources));
  values.push(...auditJobs(sourceFiles, sources));
  values.push(...auditExtensions(sourceFiles, sources));
  values.push(...auditDatabase(sources));
  values.push(...auditRoutes(sourceFiles, sources));
  values.push(...auditServices(sourceFiles));
  return [...new Map(values.map((value) => [violationKey(value), value])).values()].sort((left, right) => violationKey(left).localeCompare(violationKey(right)));
}

function selfTest() {
  if (!operationPattern.test('catalog.products.create') || operationPattern.test('catalog')) {
    throw new Error('operation identifier self-test failed');
  }
  const sourceFile = ts.createSourceFile('/tmp/self-test.ts', 'import value from "./value.js"; export { other } from "./other.js"; void import("./lazy.js");', ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const references = moduleReferences(sourceFile, new Map());
  if (references.length !== 3) throw new Error(`AST import self-test failed: ${references.length}`);
  if (!importCaseMismatch('/tmp/source.ts', { specifier: './SyncRunsHandler', target: '/tmp/SyncrunsHandler.ts' })) {
    throw new Error('import case self-test failed');
  }
  if (importCaseMismatch('/tmp/source.ts', { specifier: './SyncRunsHandler', target: '/tmp/SyncRunsHandler.ts' })) {
    throw new Error('import case positive self-test failed');
  }
  const routeFile = path.join(root, 'apps/selftest/src/routes.ts');
  const routeSource = ts.createSourceFile(routeFile, 'export const routes = [{ path: "/missing" }];', ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const routeViolations = auditRoutes(new Map([[routeFile, routeSource]]));
  if (routeViolations.length !== 1 || routeViolations[0].code !== 'ROUTE_PAGE_MISSING') {
    throw new Error('route closure self-test failed');
  }
  console.log('call-graph-self-test accepted=true parser=typescript');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argumentsSet = new Set(process.argv.slice(2));
  if (argumentsSet.has('--self-test')) {
    selfTest();
  } else {
    const violations = audit();
    if (argumentsSet.has('--json')) {
      console.log(JSON.stringify(violations, null, 2));
    } else {
      console.log(`call-graph accepted=${violations.length === 0} parser=typescript violations=${violations.length}`);
      for (const item of violations) console.log(`${item.code} ${item.location} ${item.detail}`.trim());
    }
    if (violations.length) process.exitCode = 1;
  }
}
