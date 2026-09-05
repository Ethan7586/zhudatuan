import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const sourceRoots = [
  '01_core_hexin/apps',
  '01_core_hexin/services',
  '01_core_hexin/packages',
  '01_core_hexin/extensions',
  '04_tools/tools',
].map((name) => path.join(root, name));
export const testRoots = [...sourceRoots, path.join(root, '03_quality_ceshi/tests')];
export const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
export const assetExtensions = new Set(['.css', '.gif', '.ico', '.jpeg', '.jpg', '.png', '.scss', '.svg', '.webp', '.wxss']);
export const ignoredParts = new Set(['.git', '.next', '.open-next', '.turbo', 'build', 'coverage', 'dist', 'node_modules', 'out', 'storybook-static']);
export const testParts = new Set(['test', 'tests', '__tests__', 'fixtures', '.storybook']);
export const forbiddenProductionParts = new Set(['compat', 'demo', 'fallback', 'fixture', 'fixtures', 'legacy', 'mock', 'mocks', 'simulation']);

const compilerOptions = {
  allowJs: true,
  checkJs: false,
  esModuleInterop: true,
  jsx: ts.JsxEmit.ReactJSX,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  noEmit: true,
  resolveJsonModule: true,
  skipLibCheck: true,
  target: ts.ScriptTarget.ES2022,
};
const projectOptions = new Map();

const normalize = (value) => {
  const absolute = path.resolve(value);
  return fs.existsSync(absolute) ? fs.realpathSync.native(absolute) : absolute;
};
const pathParts = (value) => path.relative(root, value).split(path.sep);

export function relative(value) {
  return path.relative(root, value).split(path.sep).join('/');
}

export function isIgnored(value) {
  return pathParts(value).some((part) => ignoredParts.has(part));
}

export function isTest(value) {
  const parts = pathParts(value).map((part) => part.toLowerCase());
  const name = path.basename(value).toLowerCase();
  return parts.some((part) => testParts.has(part)) || name.includes('.test.') || name.includes('.spec.') || name.includes('.stories.');
}

export function isConfig(value) {
  const name = path.basename(value).toLowerCase();
  return name === 'next-env.d.ts' || name === 'vite.config.ts' || name === 'vitest.config.ts' || name.includes('.config.');
}

function walk(directory, values, includeTests) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredParts.has(entry.name)) walk(target, values, includeTests);
      continue;
    }
    if (entry.isFile() && sourceExtensions.has(path.extname(entry.name)) && (includeTests || !isTest(target)) && !isConfig(target)) {
      values.push(normalize(target));
    }
  }
}

export function productionSources() {
  const values = [];
  for (const directory of sourceRoots) walk(directory, values, false);
  return values.sort();
}

export function testSources() {
  const values = [];
  for (const directory of testRoots) walk(directory, values, true);
  return [...new Set(values.filter((value) => isTest(value) || value.startsWith(`${path.join(root, 'tests')}${path.sep}`)))].sort();
}

function manifestsUnder(directory, values) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredParts.has(entry.name)) manifestsUnder(target, values);
    } else if (entry.isFile() && entry.name === 'package.json') {
      values.push(target);
    }
  }
}

export function workspacePackages() {
  const manifests = [];
  for (const directory of sourceRoots) manifestsUnder(directory, manifests);
  const packages = new Map();
  for (const manifest of manifests.sort()) {
    try {
      const payload = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      if (typeof payload.name === 'string' && payload.name) {
        packages.set(payload.name, path.dirname(manifest));
      }
    } catch {
      // Malformed manifests are reported by package tooling; they cannot be import roots.
    }
  }
  return packages;
}

export function createProgram(sources = productionSources()) {
  return ts.createProgram({ rootNames: sources, options: compilerOptions });
}

function compilerOptionsFor(source) {
  let directory = path.dirname(source);
  while (directory.startsWith(root)) {
    const config = path.join(directory, 'tsconfig.json');
    if (fs.existsSync(config)) {
      if (!projectOptions.has(config)) {
        const loaded = ts.readConfigFile(config, ts.sys.readFile);
        const parsed = loaded.error ? { options: compilerOptions } : ts.parseJsonConfigFileContent(loaded.config, ts.sys, directory, compilerOptions, config);
        projectOptions.set(config, { ...compilerOptions, ...parsed.options });
      }
      return projectOptions.get(config);
    }
    if (directory === root) break;
    directory = path.dirname(directory);
  }
  return compilerOptions;
}

function manualCandidates(base) {
  const values = [];
  const extension = path.extname(base);
  if (sourceExtensions.has(extension) || extension === '.json') {
    values.push(base);
  } else {
    for (const suffix of [...sourceExtensions, '.json']) values.push(`${base}${suffix}`);
    for (const suffix of [...sourceExtensions, '.json']) values.push(path.join(base, `index${suffix}`));
  }
  if (['.js', '.jsx', '.mjs', '.cjs'].includes(extension)) {
    const stem = base.slice(0, -extension.length);
    for (const suffix of ['.ts', '.tsx']) values.push(`${stem}${suffix}`);
  }
  return values;
}

function firstFile(candidates) {
  const found = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  return found ? normalize(found) : undefined;
}

function workspaceTarget(specifier, packages) {
  const names = [...packages.keys()].sort((left, right) => right.length - left.length);
  const name = names.find((candidate) => specifier === candidate || specifier.startsWith(`${candidate}/`));
  if (!name) return undefined;
  const directory = packages.get(name);
  const suffix = specifier === name ? '' : specifier.slice(name.length + 1);
  if (suffix) {
    return firstFile([...manualCandidates(path.join(directory, suffix)), ...manualCandidates(path.join(directory, 'src', suffix))]);
  }
  return firstFile([...manualCandidates(path.join(directory, 'src', 'index')), ...manualCandidates(path.join(directory, 'src', 'main')), ...manualCandidates(path.join(directory, 'index'))]);
}

export function resolveImport(source, specifier, packages = workspacePackages()) {
  if (assetExtensions.has(path.extname(specifier).toLowerCase())) {
    return { external: true, target: undefined };
  }
  const workspace = workspaceTarget(specifier, packages);
  if (workspace) return { external: false, target: workspace };
  const resolved = ts.resolveModuleName(specifier, source, compilerOptionsFor(source), ts.sys).resolvedModule;
  if (resolved) {
    const target = normalize(resolved.resolvedFileName);
    if (target.startsWith(`${root}${path.sep}`) && !target.includes(`${path.sep}node_modules${path.sep}`)) {
      return { external: false, target };
    }
    return { external: true, target: undefined };
  }
  if (specifier.startsWith('.')) {
    return { external: false, target: firstFile(manualCandidates(path.resolve(path.dirname(source), specifier))) };
  }
  return { external: true, target: undefined };
}

export function moduleReferences(sourceFile, packages = workspacePackages()) {
  const references = [];
  const add = (literal, owner) => {
    if (!literal || !ts.isStringLiteralLike(literal)) return;
    const position = sourceFile.getLineAndCharacterOfPosition(literal.getStart(sourceFile));
    references.push({
      line: position.line + 1,
      node: owner,
      specifier: literal.text,
      ...resolveImport(sourceFile.fileName, literal.text, packages),
    });
  };
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) add(node.moduleSpecifier, node);
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      add(node.moduleReference.expression, node);
    }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      add(node.arguments[0], node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return references;
}

export function sourceFileMap(program) {
  return new Map(
    program
      .getSourceFiles()
      .filter((sourceFile) => normalize(sourceFile.fileName).startsWith(`${root}${path.sep}`))
      .map((sourceFile) => [normalize(sourceFile.fileName), sourceFile])
  );
}

export function location(sourceFile, node) {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return `${relative(sourceFile.fileName)}:${position.line + 1}`;
}

export { ts };
