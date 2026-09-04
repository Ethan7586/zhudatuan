#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

import { createProgram, moduleReferences, productionSources, relative, root, sourceFileMap, ts } from './source.mjs';

const apps = new Set(['auth', 'console', 'storefront']);
const sources = productionSources().filter((file) => /^apps\/(?:auth|console|storefront)\/src\//.test(relative(file)));
const program = createProgram(sources);
const sourceFiles = sourceFileMap(program);
const findings = [];
const operationIds = catalogValues('packages/contract/definitions/operations.yml', 'operations', 'id');
const permissionIds = catalogValues('packages/contract/definitions/permissions.yml', 'permissions', 'code');
const navigation = parse(fs.readFileSync(path.join(root, 'config/navigation.yml'), 'utf8'));
const routeDefinitions = (navigation.routes ?? []).filter((route) => typeof route.path === 'string' && typeof route.surface === 'string');
const routePaths = new Set(routeDefinitions.map(({ path: value }) => value));
const routeBases = new Set([...routePaths].map((value) => value.split('/:', 1)[0]).filter((value) => value.length > 1));
for (const surface of apps) {
  const base = commonRouteBase(routeDefinitions.filter((route) => route.surface === surface).map((route) => route.path));
  if (base.length > 1) routeBases.add(base);
}
const frameworkColorPattern = /(?:^|\s)(?:[a-z0-9-]+:)*(?:text|bg|border|from|via|to|ring|divide|outline|shadow)-(?:black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-[0-9]{2,3})?(?=\s|$)/i;
const deviceBusinessPattern = /^(?:(?:set|use|get|is)(?:Laptop|Desktop|Tablet)|(?:Laptop|Desktop|Tablet|Mobile)(?:Home|Catalog|Product|Cart|Order|Shell|Page|View))/;
const manifests = manifestCatalog();
const manifestDirectories = [...manifests.values()].flat().map(({ file }) => relative(path.dirname(file))).sort((left, right) => right.length - left.length);

for (const file of sources) auditSource(file);
auditStyles();
auditRoutes();
auditBrand();
auditStorefrontQueryAuthority();

if (findings.length > 0) {
  console.error(`frontend boundaries rejected: ${findings.length}`);
  for (const finding of [...new Set(findings)].sort()) console.error(finding);
  process.exit(1);
}
console.log('frontend boundaries accepted: ast=true mvvm=true manifests=true queryScope=true gatewayIsolation=true crossFeaturePublic=true');

function auditSource(file) {
  const name = relative(file);
  const sourceFile = sourceFiles.get(fs.realpathSync.native(file));
  if (!sourceFile) return;
  const layer = frontendLayer(name);
  const owner = featureOwner(name);
  for (const reference of moduleReferences(sourceFile)) {
    const location = `${name}:${reference.line}`;
    const target = reference.target ? relative(reference.target) : '';
    const kind = dependencyKind(reference.specifier, target);
    if (layer === 'view') {
      if (kind.query) add('VIEW_QUERY_IMPORT', location, reference.specifier);
      if (kind.router) add('VIEW_ROUTER_IMPORT', location, reference.specifier);
      if (kind.sdk) add('VIEW_SDK_IMPORT', location, reference.specifier);
      if (kind.infrastructure) add('VIEW_INFRASTRUCTURE_IMPORT', location, reference.specifier);
    }
    if (layer === 'route' && (kind.query || kind.sdk || kind.infrastructure)) add('ROUTE_ORCHESTRATION', location, reference.specifier);
    if (layer === 'application') {
      if (kind.react || kind.router || kind.query) add('APPLICATION_REACT_IMPORT', location, reference.specifier);
      if (kind.sdk) add('APPLICATION_SDK_IMPORT', location, reference.specifier);
      if (kind.infrastructure) add('APPLICATION_INFRASTRUCTURE_IMPORT', location, reference.specifier);
    }
    if (layer === 'viewmodel' && kind.infrastructure) add('VIEWMODEL_INFRASTRUCTURE_IMPORT', location, reference.specifier);
    if (layer === 'model' && (kind.react || kind.router || kind.query || kind.sdk || kind.infrastructure)) add('MODEL_FRAMEWORK_IMPORT', location, reference.specifier);
    if (layer === 'public' && (kind.react || kind.router || kind.query || kind.sdk || kind.infrastructure || kind.viewmodel)) add('PUBLIC_FRAMEWORK_IMPORT', location, reference.specifier);
    auditFeatureReference(owner, target, location);
  }
  if (layer === 'route' && containsCall(sourceFile, new Set(['useQuery', 'useMutation', 'fetchQuery', 'ensureQueryData']))) add('ROUTE_ORCHESTRATION', name, 'query orchestration');
  if (layer === 'model' && /\b(?:window|document|navigator|localStorage|sessionStorage|indexedDB)\b/.test(sourceFile.text)) add('MODEL_FRAMEWORK_IMPORT', name, 'browser capability');
  if (/\/(?:view|ui)\//.test(name) && /\b(?:Laptop|Desktop|Tablet|Mobile)(?:Home|Catalog|Product|Cart|Order|Shell|Page)\b/.test(path.basename(name))) add('DEVICE_BUSINESS_VIEW', name, path.basename(name));
  if (frameworkColorPattern.test(sourceFile.text)) add('DESIGN_TOKEN_BYPASS', name, 'framework palette colour');
  auditDeviceIdentifiers(sourceFile, name);
  if (/Gateway\.(?:ts|tsx)$/.test(name) && gatewayEscapesDto(sourceFile)) add('GATEWAY_DTO_ESCAPE', name, 'gateway exposes transport contract');
  auditTopLevelSingleton(sourceFile, name);
  auditQueryKeys(sourceFile, name);
  auditRuntimeIdentifiers(sourceFile, name);
}

function auditRuntimeIdentifiers(sourceFile, name) {
  if (name.includes('/generated/')) return;
  const visit = (node, typeContext = false, moduleSpecifier = false) => {
    const inType = typeContext || ts.isTypeNode(node);
    if (ts.isStringLiteralLike(node) && !inType && !moduleSpecifier) {
      if (operationIds.has(node.text)) add('HARDCODED_OPERATION_ID', nodeLocation(sourceFile, node), node.text);
      if (permissionIds.has(node.text)) add('HARDCODED_PERMISSION_ID', nodeLocation(sourceFile, node), node.text);
      if (isHardcodedRoute(node)) add('HARDCODED_ROUTE', nodeLocation(sourceFile, node), node.text);
    }
    if (ts.isTemplateExpression(node) && routeBases.has(node.head.text.replace(/\/$/, ''))) add('HARDCODED_ROUTE', nodeLocation(sourceFile, node), node.head.text);
    ts.forEachChild(node, (child) => visit(child, inType, isModuleSpecifierChild(node, child)));
  };
  visit(sourceFile);
}

function isHardcodedRoute(node) {
  if (!routePaths.has(node.text) && !routeBases.has(node.text)) return false;
  return node.text !== '/' || isRouteContext(node);
}

function isRouteContext(node) {
  let current = node.parent;
  while (current && !ts.isStatement(current)) {
    if (ts.isJsxAttribute(current) && ['path', 'to'].includes(propertyName(current.name))) return true;
    if (ts.isPropertyAssignment(current) && propertyName(current.name) === 'path') return true;
    if (ts.isCallExpression(current)) {
      const callee = ts.isIdentifier(current.expression) ? current.expression.text : ts.isPropertyAccessExpression(current.expression) ? current.expression.name.text : '';
      if (['navigate', 'redirect'].includes(callee)) return true;
    }
    current = current.parent;
  }
  return false;
}

function isModuleSpecifierChild(parent, child) {
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return parent.moduleSpecifier === child;
  if (ts.isExternalModuleReference(parent)) return parent.expression === child;
  return false;
}

function auditDeviceIdentifiers(sourceFile, name) {
  const visit = (node) => {
    if (ts.isIdentifier(node) && deviceBusinessPattern.test(node.text)) add('DEVICE_BUSINESS_VIEW', nodeLocation(sourceFile, node), node.text);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

function auditFeatureReference(owner, target, location) {
  if (!owner || !target) return;
  const targetOwner = featureOwner(target);
  if (!targetOwner || targetOwner.app !== owner.app || targetOwner.feature === owner.feature) return;
  const entry = target.slice(targetOwner.directory.length + 1);
  if (entry === 'index.ts' || entry === 'index.tsx' || entry.startsWith('public/')) return;
  add('CROSS_FEATURE_INTERNAL_IMPORT', location, `${owner.feature}->${targetOwner.feature}/${entry}`);
}

function auditTopLevelSingleton(sourceFile, name) {
  if (/\/app\/Dependencies\.(?:ts|tsx)$/.test(name)) return;
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.initializer && ts.isNewExpression(declaration.initializer)) {
        const constructor = declaration.initializer.expression.getText(sourceFile);
        if (/(?:Gateway|Client)$/.test(constructor)) add('GLOBAL_GATEWAY_SINGLETON', name, constructor);
      }
    }
  }
}

function auditQueryKeys(sourceFile, name) {
  const surface = name.split('/')[1];
  if (surface !== 'console' && surface !== 'storefront') return;
  const visit = (node) => {
    if (ts.isPropertyAssignment(node) && propertyName(node.name) === 'queryKey' && ts.isArrayLiteralExpression(node.initializer) && belongsToQuery(node)) {
      const value = node.initializer.getText(sourceFile);
      const scoped = surface === 'console'
        ? /scope\.(?:kind|id)|accessVersion/.test(value)
        : /scope|handle|accessVersion|releaseVersion|catalogVersion/.test(value);
      if (!scoped) add('QUERY_KEY_SCOPE_MISSING', nodeLocation(sourceFile, node), value);
    }
    if (surface === 'storefront' && ts.isPropertyAssignment(node) && propertyName(node.name) === 'queryKey' && ts.isCallExpression(node.initializer) && belongsToQuery(node)) {
      const value = node.initializer.getText(sourceFile);
      if (!/StorefrontQuery\.bootstrap\s*\(/.test(value) && !/\.query\.(?:scoped|public)\b/.test(value)) add('QUERY_KEY_SCOPE_MISSING', nodeLocation(sourceFile, node), value);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

function auditStorefrontQueryAuthority() {
  const name = path.join(root, 'apps/storefront/src/shared/api/Query.ts');
  if (!fs.existsSync(name)) return add('QUERY_KEY_SCOPE_MISSING', relative(name), 'authority missing');
  const source = fs.readFileSync(name, 'utf8');
  for (const proof of ['identity.client', 'identity.scopeKind', 'identity.scopeId', 'identity.accessVersion', 'identity.resourceVersion']) {
    if (!source.includes(proof)) add('QUERY_KEY_SCOPE_MISSING', relative(name), proof);
  }
  for (const proof of ['identity.handle', 'identity.mall', 'identity.releaseVersion', 'identity.catalogVersion']) {
    if (!source.includes(proof)) add('QUERY_KEY_SCOPE_MISSING', relative(name), proof);
  }
}

function auditStyles() {
  for (const app of apps) {
    for (const file of files(path.join(root, 'apps', app, 'src'), /\.(?:css|scss)$/)) {
      const source = fs.readFileSync(file, 'utf8');
      if (/#[0-9a-f]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(/i.test(source)) add('DESIGN_TOKEN_BYPASS', relative(file), 'literal color');
    }
  }
}

function auditRoutes() {
  for (const route of navigation.routes ?? []) {
    const key = `${route.surface}:${route.feature}`;
    const candidates = manifests.get(key) ?? [];
    const manifest = candidates.find(({ source }) => source.includes(`'${route.id}'`) || source.includes(`"${route.id}"`));
    if (!manifest) {
      add('FEATURE_MANIFEST_MISSING', `config/navigation.yml:${route.id}`, key);
      continue;
    }
    const directory = path.dirname(manifest.file);
    if (!fs.existsSync(path.join(directory, 'index.ts')) && !fs.existsSync(path.join(directory, 'index.tsx'))) add('FEATURE_PUBLIC_ENTRY_MISSING', relative(directory), route.id);
    if (!fs.existsSync(path.join(directory, 'viewmodel'))) add('VIEWMODEL_MISSING', relative(directory), route.id);
    if (files(directory, /\.(?:test|spec)\.(?:ts|tsx)$/).length === 0) add('VIEWMODEL_TEST_MISSING', relative(directory), route.id);
  }
}

function auditBrand() {
  for (const app of apps) {
    const source = sources.filter((file) => relative(file).startsWith(`apps/${app}/src/`) && file.endsWith('.tsx')).map((file) => fs.readFileSync(file, 'utf8')).join('\n');
    if (!/<Brand\b/.test(source)) add('CANONICAL_BRAND_NOT_CONSUMED', `apps/${app}`, 'Brand');
  }
}

function manifestCatalog() {
  const catalog = new Map();
  for (const app of apps) {
    const directory = path.join(root, 'apps', app, 'src', 'feature');
    for (const file of files(directory, /Manifest\.ts$/)) {
      const source = fs.readFileSync(file, 'utf8');
      const feature = source.match(/(?:component|feature):\s*['"]([a-z][a-z0-9]*)['"]/)?.[1] ?? path.relative(directory, file).split(path.sep)[0];
      if (!feature) continue;
      const key = `${app}:${feature}`;
      catalog.set(key, [...(catalog.get(key) ?? []), { file, source }]);
    }
  }
  return catalog;
}

function frontendLayer(name) {
  const value = name.match(/^apps\/(?:auth|console|storefront)\/src\/(?:feature|entity)\/.+\/(application|infrastructure|model|public|route|ui|view|viewmodel)\//)?.[1];
  return value === 'ui' ? 'view' : value;
}

function featureOwner(name) {
  const match = name.match(/^apps\/([^/]+)\/src\/feature\//);
  if (!match) return undefined;
  const directory = manifestDirectories.find((candidate) => name === `${candidate}/Manifest.ts` || name.startsWith(`${candidate}/`));
  return directory ? { app: match[1], feature: directory.split('/').slice(4).join('/'), directory } : undefined;
}

function dependencyKind(specifier, target) {
  return {
    react: specifier === 'react' || specifier.startsWith('react/'),
    router: specifier === 'react-router' || specifier.startsWith('react-router/'),
    query: specifier === '@tanstack/react-query' || specifier.startsWith('@tanstack/react-query/'),
    sdk: specifier === '@shop/sdk' || specifier.startsWith('@shop/sdk/') || target.startsWith('packages/sdk/'),
    infrastructure: target.includes('/infrastructure/'),
    viewmodel: target.includes('/viewmodel/'),
  };
}

function containsCall(sourceFile, names) {
  let found = false;
  const visit = (node) => {
    if (found) return;
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && names.has(node.expression.text)) found = true;
    else ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function gatewayEscapesDto(sourceFile) {
  for (const statement of sourceFile.statements) {
    if (!ts.isClassDeclaration(statement) || !statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const member of statement.members) {
      if (!ts.isMethodDeclaration(member) || !member.type || member.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.PrivateKeyword)) continue;
      if (/\bOperation(?:Input|Output)For\b|\b[A-Z][A-Za-z0-9]*Dto\b/.test(member.type.getText(sourceFile))) return true;
    }
  }
  return false;
}

function belongsToQuery(node) {
  let current = node.parent;
  while (current && !ts.isCallExpression(current)) current = current.parent;
  if (!current || !ts.isCallExpression(current)) return false;
  const name = ts.isIdentifier(current.expression)
    ? current.expression.text
    : ts.isPropertyAccessExpression(current.expression)
      ? current.expression.name.text
      : '';
  return ['useQuery', 'useInfiniteQuery', 'fetchQuery', 'prefetchQuery', 'ensureQueryData'].includes(name);
}

function propertyName(name) {
  return ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? name.text : '';
}

function nodeLocation(sourceFile, node) {
  const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
  return `${relative(sourceFile.fileName)}:${line}`;
}

function files(directory, pattern, result = []) {
  if (!fs.existsSync(directory)) return result;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory() && !['coverage', 'dist', 'node_modules'].includes(entry.name)) files(target, pattern, result);
    else if (entry.isFile() && pattern.test(entry.name)) result.push(target);
  }
  return result;
}

function add(code, location, detail) {
  findings.push(`${code}:${location}:${detail}`);
}

function catalogValues(file, collection, property) {
  const document = parse(fs.readFileSync(path.join(root, file), 'utf8'), { merge: true });
  return new Set((document[collection] ?? []).map((entry) => entry[property]).filter((value) => typeof value === 'string'));
}

function commonRouteBase(paths) {
  if (paths.length === 0) return '/';
  const segments = paths.map((value) => value.split('/').filter(Boolean));
  const common = [];
  for (let index = 0; index < Math.min(...segments.map((value) => value.length)); index += 1) {
    const value = segments[0][index];
    if (segments.some((candidate) => candidate[index] !== value)) break;
    common.push(value);
  }
  return common.length === 0 ? '/' : `/${common.join('/')}`;
}
