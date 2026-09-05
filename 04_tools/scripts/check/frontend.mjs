import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const root = repositoryRoot;
const findings = [];
const clientRoot = join(root, '01_core_hexin/apps');
const designTokens = JSON.parse(readFileSync(join(root, '01_core_hexin/packages/design/src/tokens.json'), 'utf8'));

for (const file of files(clientRoot)) {
  const path = short(file);
  const source = readFileSync(file, 'utf8');
  if (/\.(?:css|wxss)$/.test(path) && /#[0-9a-f]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(/i.test(source)) findings.push(`DESIGN_TOKEN_BYPASS:${path}`);
  if (path.split('/').includes('ui') && /\bfetch\s*\(|\.call\s*\(|shared\/api|(?:^|\/)api\//m.test(source)) findings.push(`UI_NETWORK_ORCHESTRATION:${path}`);
  if (/location\.hash|HashRouter|createHashRouter/.test(source)) findings.push(`HASH_ROUTING_FORBIDDEN:${path}`);
  if (!path.includes('/src/pages/') || !/\.tsx$/.test(path)) continue;
  for (const specifier of imports(source)) {
    if (!specifier.startsWith('.')) continue;
    if (!/^\.\.\/(?:\.\.\/)?features\/[a-z][a-z0-9]*$/.test(specifier)) findings.push(`PAGE_DEEP_IMPORT:${path}:${specifier}`);
    else {
      const target = resolve(dirname(file), specifier);
      if (!['index.ts', 'index.tsx'].some((name) => existsSync(join(target, name)))) findings.push(`FEATURE_PUBLIC_ENTRY_MISSING:${path}:${specifier}`);
    }
  }
}

for (const application of ['auth-web', 'console', 'storefront-web']) {
  const source = files(join(clientRoot, application, 'src')).filter((file) => /\.tsx$/.test(file)).map((file) => readFileSync(file, 'utf8')).join('\n');
  if (!/<Brand\b/.test(source)) findings.push(`CANONICAL_BRAND_NOT_CONSUMED:01_core_hexin/apps/${application}`);
}
const miniappRoot = join(clientRoot, 'miniapp/miniprogram');
const miniappBrandmark = join(miniappRoot, 'assets/brandmark.svg');
const miniappHomePath = join(miniappRoot, 'page/home/index.wxml');
const miniappManifestPath = join(miniappRoot, 'app.json');
if (!existsSync(miniappBrandmark)) findings.push('CANONICAL_BRAND_MISSING:01_core_hexin/apps/miniapp/miniprogram/assets/brandmark.svg');
if (existsSync(miniappHomePath)) {
  const miniappBrand = readFileSync(miniappHomePath, 'utf8');
  if (!miniappBrand.includes('/assets/brandmark.svg')) findings.push('CANONICAL_BRAND_NOT_CONSUMED:01_core_hexin/apps/miniapp');
}
if (existsSync(miniappManifestPath)) {
  const miniappManifest = JSON.parse(readFileSync(miniappManifestPath, 'utf8'));
  if (miniappManifest.window?.navigationBarBackgroundColor !== designTokens.color.brand.primary
    || miniappManifest.window?.backgroundColor !== designTokens.color.surface.background
    || miniappManifest.tabBar?.selectedColor !== designTokens.color.brand.primary
    || miniappManifest.tabBar?.color !== designTokens.color.text.muted
    || miniappManifest.tabBar?.backgroundColor !== designTokens.color.surface.base) findings.push('MINIAPP_MANIFEST_TOKEN_DRIFT:01_core_hexin/apps/miniapp/miniprogram/app.json');
  if (miniappManifest.tabBar?.custom !== true || JSON.stringify(miniappManifest.tabBar?.list?.map((item) => item.text)) !== JSON.stringify(['首页', '分类', '翼码', '订单', '我的'])) {
    findings.push('MINIAPP_FROZEN_NAVIGATION_DRIFT:01_core_hexin/apps/miniapp/miniprogram/app.json');
  }
}

const knownDebt = new Set([
  'DESIGN_TOKEN_BYPASS:01_core_hexin/apps/auth-web/src/index.css',
  'DESIGN_TOKEN_BYPASS:01_core_hexin/apps/console/public/demo/variants.css',
  'DESIGN_TOKEN_BYPASS:01_core_hexin/apps/console/public/design-references/admin/first-design/_ds/nocturne-e988e8c4-aa78-44b6-8271-bee3c9ef8a68/styles.css',
  'DESIGN_TOKEN_BYPASS:01_core_hexin/apps/console/src/feature/access/member-access-workspace.css',
  'DESIGN_TOKEN_BYPASS:01_core_hexin/apps/console/src/feature/access/owner-transfer-dialog.css',
  'DESIGN_TOKEN_BYPASS:01_core_hexin/apps/console/src/feature/access/owner-transfer.css',
  'DESIGN_TOKEN_BYPASS:01_core_hexin/apps/console/src/feature/application/MallCreateJourney.css',
  'DESIGN_TOKEN_BYPASS:01_core_hexin/apps/console/src/feature/application/application-dialogs.css',
  'DESIGN_TOKEN_BYPASS:01_core_hexin/apps/console/src/feature/application/application-table.css',
  'DESIGN_TOKEN_BYPASS:01_core_hexin/apps/console/src/feature/application/application-workspace.css',
  'DESIGN_TOKEN_BYPASS:01_core_hexin/apps/console/src/feature/application/commerce-solution-center.css',
  'DESIGN_TOKEN_BYPASS:01_core_hexin/apps/console/src/feature/cockpit/cockpit.css',
  'DESIGN_TOKEN_BYPASS:01_core_hexin/apps/console/src/feature/control/control.css',
  'DESIGN_TOKEN_BYPASS:01_core_hexin/apps/console/src/feature/finance/FinancePolicyEditor.css',
  'DESIGN_TOKEN_BYPASS:01_core_hexin/apps/console/src/feature/product/product-dialogs.css',
  'DESIGN_TOKEN_BYPASS:01_core_hexin/apps/console/src/feature/product/product-drawer-panels.css',
  'DESIGN_TOKEN_BYPASS:01_core_hexin/apps/console/src/feature/product/product-drawer.css',
  'DESIGN_TOKEN_BYPASS:01_core_hexin/apps/console/src/feature/product/product-table.css',
  'DESIGN_TOKEN_BYPASS:01_core_hexin/apps/console/src/feature/product/product.css',
  'DESIGN_TOKEN_BYPASS:01_core_hexin/apps/console/src/feature/referral/referral.css',
  'DESIGN_TOKEN_BYPASS:01_core_hexin/apps/console/src/feature/voucher/voucher-dialogs.css',
  'DESIGN_TOKEN_BYPASS:01_core_hexin/apps/console/src/feature/voucher/voucher-table.css',
  'DESIGN_TOKEN_BYPASS:01_core_hexin/apps/console/src/feature/voucher/voucher-workspace.css',
  'DESIGN_TOKEN_BYPASS:01_core_hexin/apps/console/src/legacy-admin-theme.css',
  'HASH_ROUTING_FORBIDDEN:01_core_hexin/apps/console/src/shell/ScopeShell.tsx',
  'DESIGN_TOKEN_BYPASS:01_core_hexin/apps/console/src/shell/header.css',
  'DESIGN_TOKEN_BYPASS:01_core_hexin/apps/console/src/shell/navigation.css',
  'DESIGN_TOKEN_BYPASS:01_core_hexin/apps/console/src/shell.css',
  'DESIGN_TOKEN_BYPASS:01_core_hexin/apps/console/src/smart-wing-vi.css',
  'HASH_ROUTING_FORBIDDEN:01_core_hexin/apps/storefront-web/src/context/useDeviceNavigation.ts',
  'CANONICAL_BRAND_NOT_CONSUMED:01_core_hexin/apps/auth-web',
  'CANONICAL_BRAND_NOT_CONSUMED:01_core_hexin/apps/console',
  'CANONICAL_BRAND_NOT_CONSUMED:01_core_hexin/apps/storefront-web',
]);
const regressions = findings.filter((finding) => !knownDebt.has(finding));

if (regressions.length > 0) {
  console.error(`frontend boundaries rejected: ${regressions.length} new, ${findings.length - regressions.length} known`);
  for (const finding of regressions) console.error(finding);
  process.exit(1);
}
console.log(`frontend boundaries accepted: regressions=0 knownDebt=${findings.length}`);

function files(directory, result = []) {
  if (!existsSync(directory)) return result;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = join(directory, entry.name);
    if (entry.isDirectory() && !['dist', 'node_modules', '.next', '.open-next'].includes(entry.name)) files(target, result);
    else if (entry.isFile() && /\.(?:ts|tsx|js|jsx|css|wxss)$/.test(entry.name) && !/\.(?:test|spec)\./.test(entry.name)
      && !target.endsWith('/apps/miniapp/miniprogram/styles/tokens.wxss')) result.push(target);
  }
  return result;
}

function imports(source) {
  return [...source.matchAll(/(?:import|export)\s+(?:[^'"()]*?\s+from\s+)?['"]([^'"]+)['"]/g)].map((match) => match[1]);
}

function short(file) { return relative(root, file).split('\\').join('/'); }
