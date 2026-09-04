#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

import { createProgram, moduleReferences, productionSources, relative, root, sourceFileMap, ts } from './source.mjs';

const apps = new Set(['auth', 'console', 'storefront', 'miniapp', 'store', 'supplier']);
const clientsDocument = parse(fs.readFileSync(path.join(root, 'config/clients.yml'), 'utf8'));
const clients = Object.freeze((clientsDocument.clients ?? []).filter((client) => apps.has(client.id)).map((client) => Object.freeze({ id: client.id, path: client.path, sourceRoot: client.sourceRoot })));
if (clients.length !== apps.size || clients.some((client) => typeof client.path !== 'string' || typeof client.sourceRoot !== 'string')) {
  throw new Error('frontend client source roots are incomplete');
}
const sources = productionSources().filter((file) => clientForName(relative(file)) !== undefined);
const program = createProgram(sources);
const sourceFiles = sourceFileMap(program);
const findings = [];
const operationIds = catalogValues('packages/contract/definitions/operations.yml', 'operations', 'id');
const permissionIds = catalogValues('packages/contract/definitions/permissions.yml', 'permissions', 'code');
const contractValueSets = canonicalContractValueSets();
const navigation = parse(fs.readFileSync(path.join(root, 'config/navigation.yml'), 'utf8'));
const routeDefinitions = (navigation.routes ?? []).filter((route) => typeof route.path === 'string' && typeof route.surface === 'string');
const routePaths = new Set(routeDefinitions.map(({ path: value }) => value));
const routeBases = new Set([...routePaths].map((value) => value.split('/:', 1)[0]).filter((value) => value.length > 1));
for (const surface of apps) {
  const base = commonRouteBase(routeDefinitions.filter((route) => route.surface === surface).map((route) => route.path));
  if (base.length > 1) routeBases.add(base);
}
const frameworkColorPattern =
  /(?:^|\s)(?:[a-z0-9-]+:)*(?:text|bg|border|from|via|to|ring|divide|outline|shadow)-(?:black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-[0-9]{2,3})?(?=\s|$)/i;
const deviceBusinessPattern = /^(?:(?:set|use|get|is)(?:Laptop|Desktop|Tablet)|(?:Laptop|Desktop|Tablet|Mobile)(?:Home|Catalog|Product|Cart|Order|Shell|Page|View))/;
const manifests = manifestCatalog();
const manifestDirectories = [...manifests.values()]
  .flat()
  .map(({ directory }) => relative(directory))
  .sort((left, right) => right.length - left.length);

for (const file of sources) auditSource(file);
auditStyles();
auditRoutes();
auditBrand();
auditStorefrontQueryAuthority();
auditManifestContracts();
auditCommonExperienceContracts();

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
  if (containsCall(sourceFile, new Set(['fetch'])) || /\bnew\s+XMLHttpRequest\b|\baxios\s*\./.test(sourceFile.text)) add('CLIENT_RAW_TRANSPORT', name, 'generated SDK operation required');
  if (/['"]\/api\/v1\//.test(sourceFile.text)) add('CLIENT_HANDWRITTEN_OPERATION_PATH', name, 'generated operation path required');
  if (/(?:error|failure|cause)(?:\?\.)?\.message\s*(?:===|!==|==|!=)|(?:error|failure|cause)(?:\?\.)?\.message\.(?:includes|startsWith|endsWith|match)\s*\(/i.test(sourceFile.text)) {
    add('CLIENT_STRING_ERROR_BRANCH', name, 'typed failure code required');
  }
  if (/(?:permissions|capabilities)\s*[:=]\s*(?:Object\.freeze\s*\()?\s*\[/.test(sourceFile.text)) add('CLIENT_POLICY_ARRAY_DUPLICATED', name, 'server bootstrap or generated manifest required');
  auditTopLevelSingleton(sourceFile, name);
  auditQueryKeys(sourceFile, name);
  auditRuntimeIdentifiers(sourceFile, name);
  auditContractValues(sourceFile, name);
}

function auditContractValues(sourceFile, name) {
  if (name.includes('/generated/')) return;
  const topLevelUnionStarts = new Set();
  for (const statement of sourceFile.statements) {
    if (ts.isTypeAliasDeclaration(statement) && ts.isUnionTypeNode(statement.type)) {
      topLevelUnionStarts.add(statement.type.getStart(sourceFile));
      const values = statement.type.types.flatMap((item) => (ts.isLiteralTypeNode(item) && ts.isStringLiteralLike(item.literal) ? [item.literal.text] : []));
      if (values.length === statement.type.types.length && values.length > 1 && duplicatesContractValues(values, false)) {
        add('CLIENT_CONTRACT_ENUM_DUPLICATED', nodeLocation(sourceFile, statement), statement.name.text);
      }
    }
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const values = stringArray(initializerArray(declaration.initializer));
      if (values.length > 1 && duplicatesContractValues(values, true)) {
        add('CLIENT_CONTRACT_ENUM_DUPLICATED', nodeLocation(sourceFile, declaration), declaration.name.getText(sourceFile));
      }
    }
  }
  const visit = (node) => {
    if (ts.isUnionTypeNode(node) && !topLevelUnionStarts.has(node.getStart(sourceFile))) {
      const values = node.types.flatMap((item) => (ts.isLiteralTypeNode(item) && ts.isStringLiteralLike(item.literal) ? [item.literal.text] : []));
      const supported = node.types.every((item) => ts.isLiteralTypeNode(item) && (ts.isStringLiteralLike(item.literal) || item.literal.kind === ts.SyntaxKind.NullKeyword));
      if (supported && values.length > 1 && duplicatesContractValues(values, true)) add('CLIENT_CONTRACT_ENUM_DUPLICATED', nodeLocation(sourceFile, node), values.join('|'));
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'enum') {
      const values = stringArray(node.arguments[0]);
      if (values.length > 1 && duplicatesContractValues(values, true)) add('CLIENT_CONTRACT_ENUM_DUPLICATED', nodeLocation(sourceFile, node), 'inline runtime schema');
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

function initializerArray(initializer) {
  let value = initializer;
  while (value && (ts.isAsExpression(value) || ts.isSatisfiesExpression(value) || ts.isParenthesizedExpression(value))) value = value.expression;
  if (value && ts.isCallExpression(value) && ts.isPropertyAccessExpression(value.expression) && ts.isIdentifier(value.expression.expression) && value.expression.expression.text === 'Object' && value.expression.name.text === 'freeze')
    value = value.arguments[0];
  if (value && ts.isNewExpression(value) && ts.isIdentifier(value.expression) && value.expression.text === 'Set') value = value.arguments?.[0];
  return value;
}

function stringArray(node) {
  if (!node || !ts.isArrayLiteralExpression(node) || node.elements.some((item) => !ts.isStringLiteralLike(item))) return [];
  return node.elements.map((item) => item.text);
}

function duplicatesContractValues(values, exact) {
  const unique = new Set(values);
  return contractValueSets.some((authority) => (!exact || unique.size === authority.size) && unique.size <= authority.size && [...unique].every((value) => authority.has(value)));
}

function canonicalContractValueSets() {
  const sets = [];
  for (const file of files(path.join(root, 'packages/contract/src'), /\.ts$/)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/literal\(\[([^\]]+)]\)/g)) {
      const values = [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((item) => item[1]);
      if (values.length > 1) sets.push(new Set(values));
    }
    for (const match of source.matchAll(/export\s+const\s+[A-Z][A-Z0-9_]*\s*=\s*(?:Object\.freeze\()?\[([^\]]+)]/g)) {
      const values = [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((item) => item[1]);
      if (values.length > 1) sets.push(new Set(values));
    }
  }
  return sets;
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
  if (!['console', 'storefront', 'miniapp', 'store', 'supplier'].includes(surface)) return;
  const visit = (node) => {
    if (ts.isPropertyAssignment(node) && propertyName(node.name) === 'queryKey' && ts.isArrayLiteralExpression(node.initializer) && belongsToQuery(node)) {
      const value = node.initializer.getText(sourceFile);
      const scoped = ['console', 'store', 'supplier'].includes(surface) ? /scope\.(?:kind|id)|accessVersion/.test(value) : /scope|handle|accessVersion|releaseVersion|catalogVersion/.test(value);
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

function auditManifestContracts() {
  const helperBySurface = Object.freeze({
    auth: 'apps/auth/src/shared/manifest/AuthManifest.ts',
    console: 'apps/console/src/shared/manifest/ComponentManifest.ts',
    storefront: 'apps/storefront/src/shared/manifest/StorefrontManifest.ts',
    miniapp: 'apps/miniapp/miniprogram/shared/FeatureManifest.ts',
    store: 'apps/store/src/shared/FeatureManifest.ts',
    supplier: 'apps/supplier/src/shared/FeatureManifest.ts',
  });
  for (const client of clients) {
    const generatedRoot = clientSourceRoot(client);
    for (const file of ['RouteBinding.ts', 'NavigationBinding.ts']) {
      const target = path.join(generatedRoot, 'generated', file);
      if (!fs.existsSync(target) || !fs.readFileSync(target, 'utf8').startsWith('// Generated by @shop/navigationgen. Do not edit.')) add('CLIENT_GENERATED_BINDING_MISSING', relative(target), client.id);
    }
    const navigation = path.join(generatedRoot, 'generated/NavigationBinding.ts');
    const navigationSource = fs.existsSync(navigation) ? fs.readFileSync(navigation, 'utf8') : '';
    for (const field of ['operation:', 'scope:', 'capability:', 'permission:', 'title:', 'breadcrumbs:']) {
      if (client.id !== 'auth' && !navigationSource.includes(field)) add('NAVIGATION_MANIFEST_FIELD_MISSING', relative(navigation), field);
    }
    const helper = path.join(root, helperBySurface[client.id]);
    const helperSource = fs.existsSync(helper) ? fs.readFileSync(helper, 'utf8') : '';
    for (const field of ['operation', 'scope', 'capability', 'permission', 'title', 'breadcrumbs']) {
      if (!new RegExp(`\\b${field}\\b`).test(helperSource)) add('FEATURE_MANIFEST_FIELD_MISSING', relative(helper), field);
    }
  }
  for (const [key, entries] of manifests) {
    const surface = key.split(':', 1)[0];
    for (const entry of entries) {
      if (surface === 'auth') {
        for (const field of ['operation:', 'scope:', 'title:', 'breadcrumbs:']) if (!entry.source.includes(field)) add('AUTH_MANIFEST_DECLARATION_MISSING', relative(entry.file), field);
      } else if (/\boperation\s*:|@shop\/contract\/ids/.test(entry.source)) {
        add('FEATURE_OPERATION_SOURCE_DUPLICATED', relative(entry.file), 'NavigationBinding is authoritative');
      }
    }
  }
}

function auditCommonExperienceContracts() {
  const proofs = Object.freeze([
    ['packages/design/src/ResourcePanel.tsx', ['SectionBoundary', 'ResourceState']],
    ['packages/design/src/Drawer.tsx', ['SectionBoundary']],
    ['packages/design/src/organism/Dialog.tsx', ['SectionBoundary']],
    ['packages/design/src/RouteScroll.tsx', ['maximumEntries', 'scrollRestoration', 'positions.get(entry)']],
    ['apps/auth/src/route/Router.tsx', ['RouteScroll', 'location.key']],
    ['apps/console/src/shell/ScopeShell.tsx', ['RouteScroll', 'location.key']],
    ['apps/storefront/src/route/Scroll.tsx', ['RouteScroll', 'key']],
    ['apps/store/src/app/StoreApp.tsx', ['RouteScroll', 'location.entry']],
    ['apps/supplier/src/app/SupplierApp.tsx', ['RouteScroll', 'location.entry']],
    ['packages/design/src/tokens.css', ['--sw-min-touch-target: 2.75rem']],
  ]);
  for (const [file, tokens] of proofs) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    for (const token of tokens) if (!source.includes(token)) add('COMMON_EXPERIENCE_CONTRACT_MISSING', file, token);
  }
  const stateSource = fs.readFileSync(path.join(root, 'packages/design/src/ResourceState.tsx'), 'utf8');
  for (const state of ['loading', 'empty', 'forbidden', 'unavailable', 'notconfigured', 'notfound']) {
    if (!stateSource.includes(`'${state}'`)) add('RESOURCE_STATE_CONFLATED', 'packages/design/src/ResourceState.tsx', state);
  }
}

function auditStyles() {
  for (const client of clients) {
    for (const file of files(clientSourceRoot(client), /\.(?:css|scss|wxss)$/)) {
      const source = fs.readFileSync(file, 'utf8');
      if (path.basename(file) === 'tokens.wxss' && source.startsWith('/* Generated from packages/design/src/tokens.json')) continue;
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
    const directory = manifest.directory;
    const publicEntries = [path.join(directory, 'index.ts'), path.join(directory, 'index.tsx'), path.join(directory, 'public', 'index.ts'), path.join(directory, 'public', 'index.tsx')];
    if (!publicEntries.some((entry) => fs.existsSync(entry))) add('FEATURE_PUBLIC_ENTRY_MISSING', relative(directory), route.id);
    if (!fs.existsSync(path.join(directory, 'viewmodel'))) add('VIEWMODEL_MISSING', relative(directory), route.id);
    if (files(directory, /\.(?:test|spec)\.(?:ts|tsx)$/).length === 0) add('VIEWMODEL_TEST_MISSING', relative(directory), route.id);
  }
}

function auditBrand() {
  const canonicalBrand = path.join(root, 'packages/design/src/brand/brand-mark.svg');
  for (const client of clients) {
    if (client.id === 'miniapp') {
      const asset = path.join(clientSourceRoot(client), 'assets/brandmark.svg');
      const shell = path.join(clientSourceRoot(client), 'shell/shell.wxml');
      const assetMatches = fs.existsSync(canonicalBrand) && fs.existsSync(asset) && fs.readFileSync(canonicalBrand).equals(fs.readFileSync(asset));
      const shellConsumes = fs.existsSync(shell) && /["']\/assets\/brandmark\.svg["']/.test(fs.readFileSync(shell, 'utf8'));
      if (!assetMatches || !shellConsumes) add('CANONICAL_BRAND_NOT_CONSUMED', client.path, 'brandmark.svg');
      continue;
    }
    const prefix = sourcePrefix(client);
    const source = sources
      .filter((file) => relative(file).startsWith(prefix) && file.endsWith('.tsx'))
      .map((file) => fs.readFileSync(file, 'utf8'))
      .join('\n');
    if (!/<(?:Brand|OperatorWorkspace)\b/.test(source)) add('CANONICAL_BRAND_NOT_CONSUMED', client.path, 'Brand');
  }
}

function manifestCatalog() {
  const catalog = new Map();
  for (const client of clients) {
    const featureRoot = path.join(clientSourceRoot(client), 'feature');
    for (const file of files(featureRoot, /Manifest\.ts$/)) {
      const source = fs.readFileSync(file, 'utf8');
      const feature =
        source.match(/(?:component|feature):\s*['"]([a-z][a-z0-9]*)['"]/)?.[1] ??
        source.match(/define[A-Za-z]+Feature\(\s*['"]([a-z][a-z0-9]*)['"]/)?.[1] ??
        source.match(/defineMiniappManifest\(\s*['"]([a-z][a-z0-9]*)['"]/)?.[1] ??
        path.relative(featureRoot, file).split(path.sep)[0];
      if (!feature) continue;
      const directory = path.basename(path.dirname(file)) === 'public' ? path.dirname(path.dirname(file)) : path.dirname(file);
      const key = `${client.id}:${feature}`;
      catalog.set(key, [...(catalog.get(key) ?? []), { file, source, directory }]);
    }
  }
  return catalog;
}

function frontendLayer(name) {
  const client = clientForName(name);
  if (!client) return undefined;
  const local = name.slice(sourcePrefix(client).length);
  const value = local.match(/^(?:feature|entity)\/.+\/(application|infrastructure|model|public|route|ui|view|viewmodel)\//)?.[1];
  return value === 'ui' ? 'view' : value;
}

function featureOwner(name) {
  const client = clientForName(name);
  if (!client || !name.startsWith(`${sourcePrefix(client)}feature/`)) return undefined;
  const directory = manifestDirectories.find((candidate) => name === `${candidate}/Manifest.ts` || name.startsWith(`${candidate}/`));
  const featureRoot = `${sourcePrefix(client)}feature/`;
  return directory ? { app: client.id, feature: directory.slice(featureRoot.length), directory } : undefined;
}

function clientSourceRoot(client) {
  return path.join(root, client.path, client.sourceRoot);
}

function sourcePrefix(client) {
  return `${client.path}/${client.sourceRoot}/`;
}

function clientForName(name) {
  return clients.find((client) => name.startsWith(sourcePrefix(client)));
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
  const name = ts.isIdentifier(current.expression) ? current.expression.text : ts.isPropertyAccessExpression(current.expression) ? current.expression.name.text : '';
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
