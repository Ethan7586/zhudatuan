import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '../..');
const budgets = parse(readFileSync(join(root, 'config/bundles.yml'), 'utf8')).budgets;
const artifacts = [
  ['console', 'apps/console/dist', budgets.consoleInitialGzipKb, budgets.lazyFeatureGzipKb],
  ['auth', 'apps/auth/dist', budgets.authInitialGzipKb, budgets.lazyFeatureGzipKb],
  ['storefront', 'apps/storefront/dist', budgets.storefrontInitialGzipKb, budgets.lazyFeatureGzipKb],
  ['commerce', 'services/commerce/dist', null, null],
];
const forbidden = [/@smart-wing\//, /storefront-web|admin-web|auth-web|commerce-api|core-read-cache/, /\/api\/(?:health|ready|ai)(?:\b|\/)/, /\b(?:MOCK_|SIMULATION_|FALLBACK_)\b/];
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
  if (!existsSync(directory)) {
    findings.push(`BUNDLE_MISSING ${path}`);
    continue;
  }
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
if (findings.length > 0) {
  console.error(`bundle policy failed: ${findings.length}`);
  for (const finding of findings) console.error(finding);
  process.exit(1);
}
console.log('bundle policy: three clients and one commerce artifact present, retired and substitute code absent, budgets satisfied');

function measureVite(directory, code) {
  const root = existsSync(join(directory, '.vite', 'manifest.json')) ? directory : join(directory, 'client');
  const manifestPath = join(root, '.vite', 'manifest.json');
  if (!existsSync(manifestPath)) return { initial: compressed(code), lazy: 0 };
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const entries = Object.entries(manifest);
  const roots = entries.filter(([, item]) => item.isEntry).map(([key]) => key);
  if (roots.length === 0) throw new Error(`BUNDLE_ENTRY_MISSING:${relative(root, manifestPath)}`);
  const entriesWithBase = roots.map((entry) => ({ entry, base: graph(manifest, [entry]).assets }));
  const initial = Math.max(...entriesWithBase.map(({ base }) => bytes(root, base)));
  const lazy = Math.max(0, ...entriesWithBase.flatMap(({ entry, base }) => dynamicBranches(manifest, entry, base).map((branch) => bytes(root, branch))));
  return { initial, lazy };
}

function dynamicBranches(manifest, rootKey, rootAssets) {
  const output = [];
  const visit = (key, loaded, path) => {
    const current = graph(manifest, [key]);
    const available = new Set([...loaded, ...current.assets]);
    for (const staticKey of current.keys) {
      for (const dependency of manifest[staticKey]?.dynamicImports ?? []) {
        if (path.has(dependency)) continue;
        const branch = graph(manifest, [dependency]).assets;
        output.push(new Set([...branch].filter((file) => !available.has(file))));
        visit(dependency, available, new Set([...path, dependency]));
      }
    }
  };
  visit(rootKey, rootAssets, new Set([rootKey]));
  return output;
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
