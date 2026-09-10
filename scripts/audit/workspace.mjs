import { readFileSync, readdirSync, statSync, lstatSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { parse } from 'yaml';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';
import { COMMERCE_ENTRY_FILES } from '../lib/CommerceEntries.mjs';

export const ROOT = repositoryRoot;

/** Directories that never participate in search, build, format, test or release. */
export const EXCLUDED = new Set(['node_modules', '.git', '.next', '.open-next', '.wrangler', 'dist', 'build', 'storybook-static', 'coverage', '.vercel', '.codex-temp', 'tmp', 'supabase/.temp']);

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
export function isExcluded(path) {
  const normalized = relative(ROOT, path).split(/[\\/]/).join('/');
  if (normalized.startsWith('..')) return true;
  for (const part of normalized.split('/')) {
    if (EXCLUDED.has(part)) return true;
  }
  return EXCLUDED.has(normalized);
}

export function* walk(directory) {
  let entries;
  try {
    entries = readdirSync(directory);
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(directory, entry);
    if (isExcluded(full)) continue;
    if (lstatSync(full).isSymbolicLink()) throw new Error(`WORKSPACE_LINK_FORBIDDEN:${rel(full)}`);
    let info;
    try {
      info = statSync(full);
    } catch {
      continue; // broken junction or dangling symlink
    }
    if (info.isDirectory()) {
      yield* walk(full);
    } else if (info.isFile()) {
      yield full;
    }
  }
}

export function sourceFiles(directory = ROOT) {
  const files = [];
  for (const file of walk(directory)) {
    if (SOURCE_EXTENSIONS.has(extname(file))) files.push(file);
  }
  return files;
}

export function read(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

export function rel(file) {
  return relative(ROOT, file).split(/[\\/]/).join('/');
}

/** Resolves a relative import specifier to a real file, mirroring bundler resolution. */
export function resolveRelativeImport(fromFile, specifier) {
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.mts`, `${base}.js`, `${base}.jsx`, `${base}.mjs`, `${base}.cjs`, join(base, 'index.ts'), join(base, 'index.tsx'), join(base, 'index.js'), join(base, 'index.mjs')];
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* keep trying */
    }
  }
  return null;
}

const IMPORT_PATTERN = /(?:^|\n)\s*(?:import|export)\s+(?:[^'"()]*?\s+from\s+)?['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT_PATTERN = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
const REQUIRE_PATTERN = /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;

export function imports(source) {
  const found = [];
  for (const pattern of [IMPORT_PATTERN, DYNAMIC_IMPORT_PATTERN, REQUIRE_PATTERN]) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source)) !== null) found.push(match[1]);
  }
  return found;
}

/** Named and default exports declared by a module, used for call-site verification. */
export function exportedNames(source) {
  const names = new Set();
  const declaration = /export\s+(?:async\s+)?(?:function\s*\*?|class|const|let|var|type|interface|enum)\s+([A-Za-z0-9_$]+)/g;
  let match;
  while ((match = declaration.exec(source)) !== null) names.add(match[1]);
  const list = /export\s+(?:type\s+)?\{([^}]*)\}/g;
  while ((match = list.exec(source)) !== null) {
    for (const piece of match[1].split(',')) {
      const parts = piece.trim().split(/\s+as\s+/);
      const name = (parts[1] ?? parts[0]).trim();
      if (name) names.add(name);
    }
  }
  if (/export\s+default\b/.test(source)) names.add('default');
  if (/export\s+(?:type\s+)?\*\s*(?:as\s+\w+\s+)?from/.test(source)) names.add('*');
  return names;
}

/** Named bindings a file pulls from one specifier. */
export function importedBindings(source, specifier) {
  const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`import\\s+([^'"]+?)\\s+from\\s+['"]${escaped}['"]`, 'g');
  const bindings = [];
  let match;
  while ((match = pattern.exec(source)) !== null) {
    // `import type { A } from 'x'` carries no default binding; drop the modifier first.
    const clause = match[1].trim().replace(/^type\s+/, '');
    const braces = clause.match(/\{([^}]*)\}/);
    if (braces) {
      for (const piece of braces[1].split(',')) {
        const parts = piece
          .trim()
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/);
        const name = parts[0].trim();
        if (name) bindings.push(name);
      }
    }
    const defaultBinding = clause
      .replace(/\{[^}]*\}/, '')
      .replace(/,/g, '')
      .trim();
    if (defaultBinding && !defaultBinding.startsWith('*')) bindings.push('default');
  }
  return bindings;
}

export function workspaceGlobs() {
  const manifest = join(ROOT, 'package.json');
  if (!existsSync(manifest)) return [];
  try {
    return JSON.parse(readFileSync(manifest, 'utf8')).workspaces ?? [];
  } catch {
    return [];
  }
}

/** Every workspace package manifest that actually exists on disk. */
export function workspacePackages() {
  const packages = [];
  for (const glob of workspaceGlobs()) {
    const base = join(ROOT, glob.replace(/\/\*$/, ''));
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base)) {
      const manifest = join(base, entry, 'package.json');
      if (!existsSync(manifest)) continue;
      try {
        packages.push({ dir: join(base, entry), manifest, json: JSON.parse(readFileSync(manifest, 'utf8')) });
      } catch {
        /* reported by the manifest audit */
      }
    }
  }
  return packages;
}

const EXPECTED_CLIENTS = Object.freeze(['auth', 'console', 'miniapp', 'store', 'storefront', 'supplier']);
const EXPECTED_PACKAGES = Object.freeze(['authz', 'config', 'contract', 'design', 'kernel', 'presentation', 'sdk', 'telemetry', 'testing']);
const SHARED_CHANNELS = Object.freeze(['cakecore', 'core', 'jdcore', 'wanliancore']);
const BUSINESS_CHANNELS = Object.freeze(['book', 'cake', 'charge', 'flower', 'foodvoucher', 'jdfresh', 'jdproduct', 'meal', 'movie', 'supplier', 'tmall']);
const DESIGN_LAYERS = Object.freeze(['accessibility', 'atom', 'molecule', 'organism', 'template', 'theme', 'token']);
const COMMERCE_ROOTS = Object.freeze(['composition', 'entry', 'generated', 'modules', 'pipeline', 'platform', 'test']);

export function auditWorkspace() {
  const findings = [];
  const add = (code, location, detail) => findings.push({ code, location, detail });
  exactDirectories('apps', EXPECTED_CLIENTS, add, 'CLIENT_SET_INVALID');
  exactDirectories('packages', EXPECTED_PACKAGES, add, 'PACKAGE_SET_INVALID');
  exactDirectories('services', ['commerce'], add, 'SERVICE_SET_INVALID');
  requiredDirectories(['database', 'config', 'infrastructure', 'scripts', 'tests', 'docs', 'extensions/channel', 'extensions/notification', 'extensions/payment'], add);
  for (const name of ['common', 'shared', 'legacy', 'compat', 'temporary', 'demo']) {
    if (existsSync(join(ROOT, name))) add('ROOT_CATCHALL_FORBIDDEN', name, 'top-level catch-all directory');
  }

  const sourceRoot = join(ROOT, 'services/commerce/src');
  for (const name of COMMERCE_ROOTS) if (!existsSync(join(sourceRoot, name))) add('COMMERCE_ROOT_MISSING', `services/commerce/src/${name}`, name);
  for (const name of ['app', 'adapter', 'bootstrap', 'foundation']) if (existsSync(join(sourceRoot, name))) add('COMMERCE_LEGACY_ROOT_FORBIDDEN', `services/commerce/src/${name}`, name);
  exactFiles('services/commerce/src/entry', COMMERCE_ENTRY_FILES, add, 'RUNTIME_ENTRY_SET_INVALID');

  const moduleConfig = parse(readFileSync(join(ROOT, 'config/modules.yml'), 'utf8'));
  const configuredModules = [...(moduleConfig.foundation ?? []), ...(moduleConfig.support ?? []), ...(moduleConfig.business ?? [])].sort();
  const actualModules = directoryNames(join(sourceRoot, 'modules'));
  if (moduleConfig.count !== 33 || configuredModules.length !== 33 || new Set(configuredModules).size !== 33) add('MODULE_CATALOG_INVALID', 'config/modules.yml', `declared=${moduleConfig.count} configured=${configuredModules.length}`);
  compareSet(actualModules, configuredModules, (detail) => add('MODULE_SET_INVALID', 'services/commerce/src/modules', detail));
  if (!actualModules.includes('approval')) add('APPROVAL_MODULE_MISSING', 'services/commerce/src/modules/approval', 'approval');
  if (actualModules.includes('provisioning')) add('PROVISIONING_MODULE_FORBIDDEN', 'services/commerce/src/modules/provisioning', 'provisioning');
  for (const module of actualModules) {
    for (const file of ['Manifest.ts', 'Module.ts', 'public/index.ts']) if (!existsSync(join(sourceRoot, 'modules', module, file))) add('MODULE_PUBLIC_SURFACE_MISSING', `services/commerce/src/modules/${module}/${file}`, module);
  }

  const channelRoot = join(ROOT, 'extensions/channel');
  const channels = directoryNames(channelRoot);
  compareSet(channels.filter((name) => !SHARED_CHANNELS.includes(name)), BUSINESS_CHANNELS, (detail) => add('CHANNEL_EXTENSION_SET_INVALID', 'extensions/channel', detail));
  compareSet(channels.filter((name) => SHARED_CHANNELS.includes(name)), SHARED_CHANNELS, (detail) => add('CHANNEL_CORE_SET_INVALID', 'extensions/channel', detail));
  for (const shared of SHARED_CHANNELS) {
    const manifest = JSON.parse(readFileSync(join(channelRoot, shared, 'package.json'), 'utf8'));
    const consumers = channels.filter((name) => {
      if (name === shared) return false;
      const candidate = JSON.parse(readFileSync(join(channelRoot, name, 'package.json'), 'utf8'));
      return Object.hasOwn(candidate.dependencies ?? {}, manifest.name);
    });
    if (consumers.length < 2) add('CHANNEL_CORE_CONSUMER_INVALID', `extensions/channel/${shared}/package.json`, `consumers=${consumers.length}`);
  }

  const designRoot = join(ROOT, 'packages/design/src');
  for (const layer of DESIGN_LAYERS) if (!existsSync(join(designRoot, layer))) add('DESIGN_LAYER_MISSING', `packages/design/src/${layer}`, layer);
  const rootImplementations = readdirSync(designRoot, { withFileTypes: true }).filter((entry) => entry.isFile() && /\.(?:ts|tsx|css)$/.test(entry.name) && entry.name !== 'index.ts');
  for (const entry of rootImplementations) add('DESIGN_ROOT_IMPLEMENTATION_FORBIDDEN', `packages/design/src/${entry.name}`, 'move to atomic layer');
  for (const file of ['atom/Input.tsx', 'atom/Select.tsx', 'atom/Icon.tsx', 'atom/Badge.tsx', 'atom/Text.tsx', 'atom/Spinner.tsx', 'atom/Skeleton.tsx', 'organism/ImportPanel.tsx', 'template/ListWorkspace.tsx', 'template/DetailWorkspace.tsx', 'template/WizardWorkspace.tsx', 'template/EditorWorkspace.tsx', 'template/DashboardWorkspace.tsx', 'theme/SmartWing.ts', 'theme/QuietOrder.ts', 'theme/EasternGallery.ts', 'theme/WarmWorkshop.ts', 'accessibility/Focus.ts', 'accessibility/LiveRegion.tsx', 'accessibility/Contrast.ts']) {
    if (!existsSync(join(designRoot, file))) add('DESIGN_CONTRACT_MISSING', `packages/design/src/${file}`, file);
  }

  const voucherFiles = [...walk(join(sourceRoot, 'modules/voucher'))].map(rel);
  for (const file of voucherFiles) if (/(?:VoucherProgram|CardPool|ReserveRequest)/.test(file)) add('VOUCHER_LEGACY_NAME_FORBIDDEN', file, 'legacy voucher model');
  for (const required of ['VoucherProduct.ts', 'CredentialPool.ts', 'Credential.ts', 'StockRequest.ts', 'IssueOrder.ts', 'Holder.ts', 'TenderHold.ts', 'Redemption.ts']) {
    if (!voucherFiles.some((file) => file.endsWith(`/${required}`))) add('VOUCHER_RICH_SUBDOMAIN_MISSING', 'services/commerce/src/modules/voucher', required);
  }

  for (const file of sourceFiles()) {
    const location = rel(file);
    if (!ownerOf(location)) add('DIRECTORY_OWNER_MISSING', location, 'no deterministic owner boundary');
    if (file.endsWith(`${join('', 'index.ts')}`)) auditIndex(file, location, add);
  }
  return findings.sort((left, right) => `${left.code}:${left.location}`.localeCompare(`${right.code}:${right.location}`));
}

function exactDirectories(location, expected, add, code) {
  const actual = directoryNames(join(ROOT, location));
  compareSet(actual, expected, (detail) => add(code, location, detail));
}

function requiredDirectories(locations, add) {
  for (const location of locations) if (!existsSync(join(ROOT, location))) add('WORKSPACE_ROOT_MISSING', location, location);
}

function directoryNames(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !EXCLUDED.has(entry.name) && !entry.name.startsWith('.')).map((entry) => entry.name).sort();
}

function exactFiles(location, expected, add, code) {
  const actual = readdirSync(join(ROOT, location), { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith('Main.ts')).map((entry) => entry.name).sort();
  compareSet(actual, expected, (detail) => add(code, location, detail));
}

function compareSet(actual, expected, report) {
  const current = [...actual].sort();
  const target = [...expected].sort();
  if (JSON.stringify(current) !== JSON.stringify(target)) report(`actual=${current.join(',')} expected=${target.join(',')}`);
}

function ownerOf(location) {
  const parts = location.split('/');
  if (parts.length === 1) return 'workspace:root';
  if (parts[0] === 'apps' && EXPECTED_CLIENTS.includes(parts[1])) return `client:${parts[1]}`;
  if (parts[0] === 'packages' && EXPECTED_PACKAGES.includes(parts[1])) return `package:${parts[1]}`;
  if (parts[0] === 'extensions' && ['channel', 'notification', 'payment'].includes(parts[1]) && parts[2]) return `extension:${parts[1]}:${parts[2]}`;
  if (parts[0] === 'tools' && parts[1]) return `tool:${parts[1]}`;
  if (parts[0] === 'services' && parts[1] === 'commerce' && parts[3] === 'modules' && parts[4]) return `module:${parts[4]}`;
  if (parts[0] === 'services' && parts[1] === 'commerce' && COMMERCE_ROOTS.includes(parts[3])) return `commerce:${parts[3]}`;
  if (parts[0] === 'services' && parts[1] === 'commerce' && parts[2] === 'tests') return 'commerce:test';
  if (parts[0] === 'services' && parts[1] === 'commerce' && parts[2]?.includes('.config.')) return 'commerce:configuration';
  if (['config', 'database', 'docs', 'infrastructure', 'scripts', 'tests'].includes(parts[0])) return `workspace:${parts[0]}`;
  return undefined;
}

function auditIndex(file, location, add) {
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true);
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && statement.importClause === undefined) add('INDEX_SIDE_EFFECT_IMPORT_FORBIDDEN', location, statement.moduleSpecifier.getText(source));
    if (ts.isExpressionStatement(statement) || ts.isForStatement(statement) || ts.isForOfStatement(statement) || ts.isForInStatement(statement) || ts.isWhileStatement(statement) || ts.isTryStatement(statement)) {
      add('INDEX_INITIALIZATION_SIDE_EFFECT_FORBIDDEN', location, ts.SyntaxKind[statement.kind]);
    }
    if (!ts.isImportDeclaration(statement) && !hasExport(statement)) add('INDEX_PRIVATE_DECLARATION_FORBIDDEN', location, ts.SyntaxKind[statement.kind]);
  }
}

function hasExport(statement) {
  if (ts.isExportDeclaration(statement) || ts.isExportAssignment(statement)) return true;
  return statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const findings = auditWorkspace();
  for (const finding of findings) console.error(`${finding.code} ${finding.location} ${finding.detail}`);
  console.log(`workspace findings: ${findings.length}`);
  process.exit(findings.length === 0 ? 0 : 1);
}
