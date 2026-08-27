import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { report } from './report.mjs';

const root = resolve(import.meta.dirname, '../..');
const routerFile = join(root, 'apps/console/src/route/ConsoleRouter.tsx');
const workstationFile = join(root, 'apps/console/src/shell/Workstation.ts');
const professionalFile = join(root, 'apps/console/src/route/ProfessionalRouteCatalog.ts');
const routes = readFileSync(routerFile, 'utf8');
const workstation = readFileSync(workstationFile, 'utf8');
const professional = readFileSync(professionalFile, 'utf8');
const miniapp = JSON.parse(readFileSync(join(root, 'apps/miniapp/miniprogram/app.json'), 'utf8'));
const actionDispatcher = join(root, 'apps/miniapp/miniprogram/navigation/actions.js');
const violations = [];

const routePaths = [...routes.matchAll(/\bpath:\s*'([^']+)'/g)].map((match) => match[1]);
const workstationKeys = [...workstation.matchAll(/\{\s*key:\s*'([^']+)'/g)].map((match) => match[1]);
const professionalPaths = [...professional.matchAll(/\broute\(\s*'[^']+'\s*,\s*'([^']+)'/g)].map((match) => match[1]);

if (!routePaths.includes('/scopes/:scopeKind/:scopeId')) {
  violations.push({ code: 'CONSOLE_SCOPE_ROUTE_MISSING', location: 'apps/console/src/route/ConsoleRouter.tsx', detail: 'URL scope root' });
}
for (const key of workstationKeys) {
  if (!routePaths.includes(key)) violations.push({ code: 'CONSOLE_WORKSTATION_ROUTE_MISSING', location: key, detail: 'semantic route' });
}
for (const path of professionalPaths) {
  if (!routePaths.some((candidate) => routeCovers(candidate, path))) {
    violations.push({ code: 'CONSOLE_PROFESSIONAL_ROUTE_MISSING', location: path, detail: 'professional route catalog' });
  }
}
for (const match of routes.matchAll(/import\('([^']+)'\)/g)) {
  const target = resolveModule(dirname(routerFile), match[1]);
  if (!target) violations.push({ code: 'CONSOLE_ROUTE_MODULE_MISSING', location: match[1], detail: 'lazy route module' });
}
if (/workstations|ResourceBoard|features\/workstation/.test(routes)) {
  violations.push({ code: 'CONSOLE_RETIRED_ROUTE_REGISTRY', location: 'apps/console/src/route/ConsoleRouter.tsx', detail: 'hard-cut semantic router required' });
}

for (const page of miniapp.pages ?? []) {
  for (const extension of ['.js', '.json', '.wxml']) {
    const file = join(root, 'apps/miniapp/miniprogram', `${page}${extension}`);
    if (!existsSync(file)) violations.push({ code: 'MINIAPP_PAGE_FILE_MISSING', location: page, detail: extension });
  }
}
if (!existsSync(actionDispatcher)) violations.push({ code: 'EXPERIENCE_ACTION_DISPATCHER_MISSING', location: 'apps/miniapp', detail: 'seven registered actions' });
else {
  const source = readFileSync(actionDispatcher, 'utf8');
  for (const type of ['link', 'product', 'category', 'collection', 'exchangeableproduct', 'micropage', 'marketingactivity']) {
    if (!source.includes(`${type}:`)) violations.push({ code: 'EXPERIENCE_ACTION_UNREGISTERED', location: actionDispatcher, detail: type });
  }
}
report('navigation', violations);

function routeCovers(candidate, catalogPath) {
  const routeSegments = candidate.split('/');
  const catalogSegments = catalogPath.split('/');
  let routeIndex = 0;
  let catalogIndex = 0;
  while (routeIndex < routeSegments.length) {
    const routeSegment = routeSegments[routeIndex];
    const optional = routeSegment.startsWith(':') && routeSegment.endsWith('?');
    if (optional && catalogIndex >= catalogSegments.length) { routeIndex += 1; continue; }
    const catalogSegment = catalogSegments[catalogIndex];
    if (catalogSegment === undefined || (!routeSegment.startsWith(':') && !catalogSegment.startsWith(':') && routeSegment !== catalogSegment)) return false;
    routeIndex += 1;
    catalogIndex += 1;
  }
  return catalogIndex === catalogSegments.length;
}

function resolveModule(directory, specifier) {
  for (const suffix of ['.tsx', '.ts', '/index.tsx', '/index.ts']) {
    const candidate = resolve(directory, `${specifier}${suffix}`);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}
