import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { productionSources, relative, root } from '../check/source.mjs';

const findings = [];
const retiredDirectories = ['01_core_hexin/apps/admin-web', '01_core_hexin/apps/auth-web', '01_core_hexin/apps/storefront-web', '01_core_hexin/apps/wechat-miniapp', '01_core_hexin/services/commerce-api', '01_core_hexin/services/core-read-cache', '01_core_hexin/services/jobs'];
const auxiliaryDirectories = ['archive', 'artifacts', 'deliverables', 'pre-contract-code-merge-20260820', 'smart-wing-branch-work'];
const retiredStorefrontRuntime = ['01_core_hexin/apps/storefront/.next', '01_core_hexin/apps/storefront/.open-next', '01_core_hexin/apps/storefront/.vinext', '01_core_hexin/apps/storefront/.wrangler',
  '01_core_hexin/apps/storefront/pages', '01_core_hexin/apps/storefront/next.config.ts', '01_core_hexin/apps/storefront/vinext.config.ts', '01_core_hexin/apps/storefront/wrangler.toml'];
const retiredReferences = [
  ['OLD_PACKAGE_SCOPE', '@smart-wing/'],
  ['OLD_ROUTE', '/api/health'],
  ['OLD_ROUTE', '/api/ready'],
  ['OLD_ROUTE', '/api/ai'],
  ['OLD_ENV', 'CORE_READ_CACHE_'],
  ['OLD_ENV', 'PAYMENT_OUTBOX_ENABLED'],
  ['OLD_ENV', 'SUPABASE_SERVICE_ROLE_KEY'],
];

for (const directory of retiredDirectories) if (existsSync(resolve(root, directory))) findings.push(`RETIRED_DIRECTORY ${directory}`);
for (const directory of auxiliaryDirectories) if (existsSync(resolve(root, directory))) findings.push(`AUXILIARY_DIRECTORY ${directory}`);
for (const runtime of retiredStorefrontRuntime) if (existsSync(resolve(root, runtime))) findings.push(`RETIRED_STOREFRONT_RUNTIME ${runtime}`);
for (const file of productionSources()) {
  const path = relative(file);
  const source = readFileSync(file, 'utf8');
  for (const [code, value] of retiredReferences) if (source.includes(value)) findings.push(`${code} ${path} ${value}`);
  if (/(^|\/)(compat|demo|fallback|fixture|fixtures|legacy|mock|mocks|simulation)(\/|$)/i.test(path)) findings.push(`FORBIDDEN_PRODUCTION_PATH ${path}`);
  if (/\b(?:mock|simulation|fallback)\s*(?:mode|provider|adapter|service)\b/i.test(source)) findings.push(`FORBIDDEN_PRODUCTION_BEHAVIOR ${path}`);
}

if (findings.length > 0) {
  console.error(`hard-cut regression failed: ${findings.length}`);
  for (const finding of findings) console.error(finding);
  process.exit(1);
}
console.log('hard-cut regression: no retired runtime, route, package, environment, or production substitute');
