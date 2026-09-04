import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { report } from './report.mjs';

const root = resolve(import.meta.dirname, '../..');
const routerFile = join(root, 'apps/console/src/route/Router.tsx');
const registryFile = join(root, 'apps/console/src/app/RouteRegistry.ts');
const routes = readFileSync(routerFile, 'utf8');
const registry = readFileSync(registryFile, 'utf8');
const violations = [];
if (!routes.includes('path: ROUTE_BASE') || !routes.includes("from '../generated/RouteBinding'")) {
  violations.push({ code: 'CONSOLE_SCOPE_ROUTE_MISSING', location: 'apps/console/src/route/Router.tsx', detail: 'URL scope root' });
}
if (!routes.includes('registry.routes()')) {
  violations.push({ code: 'CONSOLE_REGISTRY_ROUTES_BYPASSED', location: 'apps/console/src/route/Router.tsx', detail: 'route registry' });
}
for (const match of registry.matchAll(/from '([^']+\/Manifest)'/g)) {
  if (!resolveModule(dirname(registryFile), match[1])) {
    violations.push({ code: 'CONSOLE_MANIFEST_MODULE_MISSING', location: match[1], detail: 'workspace manifest' });
  }
}
if (/workstations|ResourceBoard|features\/workstation/.test(routes)) {
  violations.push({ code: 'CONSOLE_RETIRED_ROUTE_REGISTRY', location: 'apps/console/src/route/Router.tsx', detail: 'hard-cut semantic router required' });
}
report('navigation', violations);

function resolveModule(directory, specifier) {
  for (const suffix of ['.tsx', '.ts', '/index.tsx', '/index.ts']) {
    const candidate = resolve(directory, `${specifier}${suffix}`);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}
