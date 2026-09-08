import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '../..');
const budgets = parse(readFileSync(join(root, 'config/bundles.yml'), 'utf8')).budgets;
const capacity = parse(readFileSync(join(root, 'config/capacity.yml'), 'utf8'));
const telemetry = parse(readFileSync(join(root, 'config/telemetry.yml'), 'utf8'));
const artifacts = [
  ['console', 'apps/console/dist', budgets.initialGzipKb.console, budgets.lazyFeatureGzipKb],
  ['auth', 'apps/auth/dist', budgets.initialGzipKb.auth, budgets.lazyFeatureGzipKb],
  ['storefront', 'apps/storefront/dist', budgets.initialGzipKb.storefront, budgets.lazyFeatureGzipKb],
  ['store', 'apps/store/dist', budgets.initialGzipKb.store, budgets.lazyFeatureGzipKb],
  ['supplier', 'apps/supplier/dist', budgets.initialGzipKb.supplier, budgets.lazyFeatureGzipKb],
  ['commerce', 'services/commerce/dist', null, null],
];
const forbidden = [/@smart-wing\//, /storefront-web|admin-web|auth-web|commerce-api|core-read-cache/, /\/api\/(?:health|ready|ai)(?:\b|\/)/, /\b(?:MOCK_|SIMULATION_|FALLBACK_)\b/];
const forbiddenSource = /(?:^|\/)(?:Legacy|Compat|Mock|Showcase|Demo)(?:[A-Z./]|$)|(?:^|\/)(?:Desktop|Laptop|Tablet|Mobile)(?:Home|Catalog|Product|Cart|Order|Shell|Page|View)/i;
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
  assertProductionSources(directory, name);
  if (typeof budget === 'number') {
    const measured = measureVite(directory, code);
    const initial = measured.initial / 1024;
    if (initial > budget) findings.push(`BUNDLE_BUDGET ${name} ${initial.toFixed(1)}KB-gzip>${budget}KB-gzip`);
    if (typeof lazyBudget === 'number' && measured.lazy > lazyBudget * 1024) {
      findings.push(`BUNDLE_LAZY_BUDGET ${name} ${(measured.lazy / 1024).toFixed(1)}KB-gzip>${lazyBudget}KB-gzip`);
    }
  }
}
measureMiniapp();
assertQrSplit();
assertCommerceErrorContract();
if (findings.length > 0) {
  console.error(`bundle policy failed: ${findings.length}`);
  for (const finding of findings) console.error(finding);
  process.exit(1);
}
console.log('bundle policy: six clients and four-process commerce artifact present, retired and substitute code absent, budgets satisfied');

function measureMiniapp() {
  const directory = join(root, 'apps/miniapp/dist/miniprogram');
  if (!existsSync(directory)) {
    findings.push('BUNDLE_MISSING apps/miniapp/dist/miniprogram');
    return;
  }
  const manifestPath = join(directory, 'app.json');
  if (!existsSync(manifestPath)) {
    findings.push('BUNDLE_MINIAPP_MANIFEST_MISSING');
    return;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const subpackages = manifest.subPackages ?? [];
  if (!Array.isArray(manifest.pages) || manifest.pages.length !== 1 || manifest.pages[0] !== 'feature/home/page' || !Array.isArray(subpackages) || subpackages.length < 1) findings.push('BUNDLE_MINIAPP_SPLIT_INVALID');
  const entries = files(directory).filter((file) => !file.endsWith('.map'));
  if (files(directory).some((file) => file.endsWith('.map'))) findings.push('BUNDLE_MINIAPP_SOURCEMAP_EXPOSED');
  const roots = subpackages.map(({ root: value }) => `${value}/`);
  const initial = entries.filter((file) => !roots.some((value) => relative(directory, file).startsWith(value)));
  const initialBytes = compressed(initial);
  const initialBudget = budgets.initialGzipKb.miniapp * 1024;
  if (initialBytes > initialBudget) findings.push(`BUNDLE_BUDGET miniapp ${(initialBytes / 1024).toFixed(1)}KB-gzip>${budgets.initialGzipKb.miniapp}KB-gzip`);
  const featureBudget = capacity.clients.miniapp.featureGzipKb * 1024;
  for (const { root: value, pages } of subpackages) {
    if (typeof value !== 'string' || !Array.isArray(pages) || pages.length < 1) {
      findings.push('BUNDLE_MINIAPP_SUBPACKAGE_INVALID');
      continue;
    }
    const feature = entries.filter((file) => relative(directory, file).startsWith(`${value}/`));
    const size = compressed(feature);
    if (size > featureBudget) findings.push(`BUNDLE_FEATURE_BUDGET miniapp:${value} ${(size / 1024).toFixed(1)}KB-gzip>${capacity.clients.miniapp.featureGzipKb}KB-gzip`);
  }
  for (const file of entries.filter((candidate) => ['.js', '.wxss'].includes(extname(candidate)))) {
    const source = readFileSync(file, 'utf8');
    for (const pattern of forbidden) if (pattern.test(source)) findings.push(`BUNDLE_FORBIDDEN ${relative(root, file)} ${pattern}`);
    if (/sourceMappingURL=/.test(source)) findings.push(`BUNDLE_SOURCEMAP_LINKED ${relative(root, file)}`);
  }
}

function assertCommerceErrorContract() {
  const artifact = join(root, 'services/commerce/dist/ApiMain.js');
  if (!existsSync(artifact)) return;
  const source = readFileSync(artifact, 'utf8');
  const initialization = source.indexOf('init_ErrorContract();');
  const consumer = source.indexOf('var ErrorPresenter');
  if (initialization < 0 || consumer < 0 || initialization > consumer) findings.push('BUNDLE_ERROR_CONTRACT_UNINITIALIZED commerce');
}

function assertQrSplit() {
  const directory = join(root, 'apps/console/dist');
  const manifestPath = join(directory, '.vite', 'manifest.json');
  if (!existsSync(manifestPath)) return;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const qrKey = Object.keys(manifest).find((key) => key.endsWith('packages/design/src/atom/QrCode.tsx'));
  const experienceKey = Object.keys(manifest).find((key) => key.endsWith('src/feature/experience/route/ExperienceRoute.tsx'));
  const roots = Object.entries(manifest)
    .filter(([, item]) => item.isEntry)
    .map(([key]) => key);
  if (!qrKey || !experienceKey || roots.length === 0) {
    findings.push('BUNDLE_QR_ENTRY_MISSING console');
    return;
  }
  if (!(manifest[experienceKey].dynamicImports ?? []).includes(qrKey)) findings.push('BUNDLE_QR_NOT_LAZY console');
  const initial = graph(manifest, roots).assets;
  if (manifest[qrKey].file && initial.has(manifest[qrKey].file)) findings.push('BUNDLE_QR_IN_INITIAL console');
  const qrBytes = bytes(directory, graph(manifest, [qrKey]).assets);
  const qrBudget = telemetry.slo.qrBundleGzipKb * 1024;
  if (qrBytes > qrBudget) findings.push(`BUNDLE_QR_BUDGET console ${(qrBytes / 1024).toFixed(1)}KB-gzip>${telemetry.slo.qrBundleGzipKb}KB-gzip`);
}

function measureVite(directory, code) {
  const root = existsSync(join(directory, '.vite', 'manifest.json')) ? directory : join(directory, 'client');
  const manifestPath = join(root, '.vite', 'manifest.json');
  if (!existsSync(manifestPath)) return { initial: compressed(code), lazy: 0 };
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assertChunkBudgets(root, manifest);
  const entries = Object.entries(manifest);
  const roots = entries.filter(([, item]) => item.isEntry).map(([key]) => key);
  if (roots.length === 0) throw new Error(`BUNDLE_ENTRY_MISSING:${relative(root, manifestPath)}`);
  const entriesWithBase = roots.map((entry) => ({ entry, base: graph(manifest, [entry]).assets }));
  const initial = Math.max(...entriesWithBase.map(({ base }) => bytes(root, base)));
  const lazy = Math.max(0, ...entriesWithBase.flatMap(({ entry, base }) => dynamicBranches(manifest, entry, base).map((branch) => bytes(root, branch))));
  return { initial, lazy };
}

function assertProductionSources(directory, name) {
  const roots = [join(directory, '.vite/manifest.json'), join(directory, 'client/.vite/manifest.json')];
  const manifestPath = roots.find(existsSync);
  if (!manifestPath) return;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  for (const key of Object.keys(manifest)) if (forbiddenSource.test(key)) findings.push(`BUNDLE_FORBIDDEN_SOURCE ${name} ${key}`);
}

function assertChunkBudgets(directory, manifest) {
  const references = new Map();
  for (const item of Object.values(manifest)) {
    for (const key of [...(item.imports ?? []), ...(item.dynamicImports ?? [])]) references.set(key, (references.get(key) ?? 0) + 1);
  }
  for (const [key, item] of Object.entries(manifest)) {
    if (!item.file || !existsSync(join(directory, item.file))) continue;
    const size = gzipSync(readFileSync(join(directory, item.file)), { level: 9 }).byteLength;
    if (key.includes('/feature/') && size > budgets.featureChunkGzipKb * 1024) findings.push(`BUNDLE_FEATURE_BUDGET ${key} ${(size / 1024).toFixed(1)}KB-gzip>${budgets.featureChunkGzipKb}KB-gzip`);
    if ((references.get(key) ?? 0) > 1 && size > budgets.sharedChunkGzipKb * 1024) findings.push(`BUNDLE_SHARED_BUDGET ${key} ${(size / 1024).toFixed(1)}KB-gzip>${budgets.sharedChunkGzipKb}KB-gzip`);
  }
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
