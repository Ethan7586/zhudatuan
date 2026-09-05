import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '../../..');
const budgets = parse(readFileSync(join(root, '02_platform_pingtai/config/bundles.yml'), 'utf8')).budgets;
const artifacts = [
  ['console', '01_core_hexin/apps/console/dist', budgets.consoleInitialGzipKb, budgets.lazyFeatureGzipKb],
  ['auth', '01_core_hexin/apps/auth-web/dist', budgets.authInitialGzipKb, budgets.lazyFeatureGzipKb],
  ['storefront', '01_core_hexin/apps/storefront-web/dist', budgets.storefrontInitialGzipKb, budgets.lazyFeatureGzipKb],
  ['commerce', '01_core_hexin/services/commerce/dist', null, null],
];
const forbidden = [/admin-web|commerce-api|core-read-cache/, /\/api\/(?:health|ready|ai)(?:\b|\/)/, /\b(?:MOCK_|SIMULATION_|FALLBACK_)\b/];
const findings = [];

function files(directory, output = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = join(directory, entry.name);
    if (entry.isDirectory()) files(target, output);
    else if (entry.isFile()) output.push(target);
  }
  return output;
}

for (const [name, path, budget, lazyBudget] of artifacts) {
  const directory = join(root, path);
  if (!existsSync(directory)) { findings.push(`BUNDLE_MISSING ${path}`); continue; }
  const entries = files(directory);
  const code = entries.filter((file) => ['.css', '.js', '.mjs'].includes(extname(file)) && !file.endsWith('.map'));
  for (const file of code) {
    const source = readFileSync(file, 'utf8');
    for (const pattern of forbidden) if (pattern.test(source)) findings.push(`BUNDLE_FORBIDDEN ${relative(root, file)} ${pattern}`);
  }
  if (typeof budget === 'number') {
    const measured = measureVite(directory, code);
    const initial = measured.initial / 1024;
    if (initial > budget) findings.push(`BUNDLE_BUDGET ${name} ${initial.toFixed(1)}KB-gzip>${budget}KB-gzip`);
    if (typeof lazyBudget === 'number' && measured.lazy > lazyBudget * 1024) {
      findings.push(`BUNDLE_LAZY_BUDGET ${name} ${(measured.lazy / 1024).toFixed(1)}KB-gzip>${lazyBudget}KB-gzip`);
    }
  }
}
const miniapp = join(root, '01_core_hexin/apps/miniapp/miniprogram');
if (!existsSync(miniapp)) findings.push('BUNDLE_MISSING 01_core_hexin/apps/miniapp/miniprogram');
else {
  const bytes = files(miniapp).reduce((sum, file) => sum + statSync(file).size, 0) / 1024;
  if (bytes > budgets.miniappMainKb) findings.push(`BUNDLE_BUDGET miniapp ${bytes.toFixed(1)}KB>${budgets.miniappMainKb}KB`);
}

if (findings.length > 0) {
  console.error(`bundle policy failed: ${findings.length}`);
  for (const finding of findings) console.error(finding);
  process.exit(1);
}
console.log('bundle policy: five current artifacts present, retired and substitute code absent, budgets satisfied');

function measureVite(directory, code) {
  const manifestPath = join(directory, '.vite', 'manifest.json');
  if (!existsSync(manifestPath)) return { initial: compressed(code), lazy: 0 };
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const entries = Object.entries(manifest);
  const roots = entries
    .filter(([, item]) => item.isEntry)
    .map(([key]) => key);
  if (roots.length === 0) throw new Error(`BUNDLE_ENTRY_MISSING:${relative(root, manifestPath)}`);
  const entriesWithBase = roots.map((entry) => ({ entry, base: graph(manifest, [entry]).assets }));
  const initial = Math.max(...entriesWithBase.map(({ base }) => bytes(directory, base)));
  const lazy = Math.max(0, ...entriesWithBase.flatMap(({ entry, base }) => dynamicEntries(manifest, entry).map((key) => {
    const branch = graph(manifest, [key]).assets;
    return bytes(directory, new Set([...branch].filter((file) => !base.has(file))));
  })));
  return { initial, lazy };
}

function dynamicEntries(manifest, rootKey) {
  const pending = [rootKey];
  const visited = new Set();
  const dynamic = new Set();
  while (pending.length > 0) {
    const key = pending.pop();
    if (visited.has(key)) continue;
    visited.add(key);
    const item = manifest[key];
    if (!item) continue;
    pending.push(...(item.imports ?? []));
    for (const dependency of item.dynamicImports ?? []) {
      dynamic.add(dependency);
      pending.push(dependency);
    }
  }
  return [...dynamic];
}

function graph(manifest, roots) {
  const assets = new Set();
  const keys = new Set();
  const visit = (key) => {
    if (keys.has(key)) return;
    keys.add(key);
    const item = manifest[key];
    if (!item) return;
    if (item.file) assets.add(item.file);
    for (const css of item.css ?? []) assets.add(css);
    for (const dependency of item.imports ?? []) visit(dependency);
  };
  for (const key of roots) visit(key);
  return { assets, keys };
}

function bytes(directory, assets) {
  return compressed([...assets].map((asset) => join(directory, asset)).filter(existsSync));
}

function compressed(paths) {
  return paths.reduce((sum, file) => sum + gzipSync(readFileSync(file), { level: 9 }).byteLength, 0);
}
