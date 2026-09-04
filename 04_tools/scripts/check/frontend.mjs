import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const root = repositoryRoot;
const findings = [];
const clientRoot = join(root, 'apps');
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

for (const application of ['auth', 'console', 'store', 'supplier', 'storefront']) {
  const source = files(join(clientRoot, application, 'src')).filter((file) => /\.tsx$/.test(file)).map((file) => readFileSync(file, 'utf8')).join('\n');
  if (!/<Brand\b/.test(source)) findings.push(`CANONICAL_BRAND_NOT_CONSUMED:01_core_hexin/apps/${application}`);
}
const miniappBrand = readFileSync(join(clientRoot, 'miniapp/miniprogram/page/home/index.wxml'), 'utf8');
if (!miniappBrand.includes('/assets/brandmark.svg')) findings.push('CANONICAL_BRAND_NOT_CONSUMED:01_core_hexin/apps/miniapp');
const miniappManifest = JSON.parse(readFileSync(join(clientRoot, 'miniapp/miniprogram/app.json'), 'utf8'));
if (miniappManifest.window?.navigationBarBackgroundColor !== designTokens.color.brand.primary
  || miniappManifest.window?.backgroundColor !== designTokens.color.surface.background
  || miniappManifest.tabBar?.selectedColor !== designTokens.color.brand.primary
  || miniappManifest.tabBar?.color !== designTokens.color.text.muted
  || miniappManifest.tabBar?.backgroundColor !== designTokens.color.surface.base) findings.push('MINIAPP_MANIFEST_TOKEN_DRIFT:01_core_hexin/apps/miniapp/miniprogram/app.json');
if (miniappManifest.tabBar?.custom !== true || JSON.stringify(miniappManifest.tabBar?.list?.map((item) => item.text)) !== JSON.stringify(['首页', '分类', '翼码', '订单', '我的'])) {
  findings.push('MINIAPP_FROZEN_NAVIGATION_DRIFT:01_core_hexin/apps/miniapp/miniprogram/app.json');
}

if (findings.length > 0) {
  console.error(`frontend boundaries rejected: ${findings.length}`);
  for (const finding of findings) console.error(finding);
  process.exit(1);
}
console.log('frontend boundaries accepted: pagePublicEntries=true uiNetworkCalls=0 hashRoutes=0 designTokenBypass=0 canonicalBrand=true');

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
