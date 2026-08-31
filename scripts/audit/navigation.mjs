import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { report } from './report.mjs';

const root = resolve(import.meta.dirname, '../..');
const routerFile = join(root, 'apps/console/src/route/ConsoleRouter.tsx');
const registryFile = join(root, 'apps/console/src/route/ConsoleModuleRegistry.ts');
const workstationFile = join(root, 'apps/console/src/shell/Workstation.ts');
const professionalFile = join(root, 'apps/console/src/route/ProfessionalRouteCatalog.ts');
const routes = readFileSync(routerFile, 'utf8');
const registry = readFileSync(registryFile, 'utf8');
const workstation = readFileSync(workstationFile, 'utf8');
const professional = readFileSync(professionalFile, 'utf8');
const manifestFiles = [...registry.matchAll(/from '([^']+\/manifest)'/g)]
  .map(([, specifier]) => resolveModule(dirname(registryFile), specifier))
  .filter((file) => file !== undefined);
const manifests = manifestFiles.map((file) => ({ file, source: readFileSync(file, 'utf8') }));
const moduleIds = manifests.flatMap(({ source }) => [...source.matchAll(/^\s*id:\s*'([^']+)'/gm)].slice(0, 1).map((match) => match[1]));
const routeIds = manifests.flatMap(({ source }) => [...source.matchAll(/\bid:\s*'([^']+\.[^']+)'/g)].map((match) => match[1]));
const routePaths = manifests.flatMap(({ source }) => [...source.matchAll(/\bpath:\s*'([^']+)'/g)].map((match) => match[1]));
const miniappManifest = join(root, 'apps/miniapp/miniprogram/app.json');
const actionDispatcher = join(root, 'apps/miniapp/miniprogram/navigation/actions.js');
const violations = [];

if (!/path:\s*'\/scopes\/:scopeKind\/:scopeId'/.test(routes)) {
  violations.push({ code: 'CONSOLE_SCOPE_ROUTE_MISSING', location: 'apps/console/src/route/ConsoleRouter.tsx', detail: 'URL scope root' });
}
if (manifestFiles.length === 0) {
  violations.push({ code: 'CONSOLE_MODULE_MANIFEST_MISSING', location: 'apps/console/src/route/ConsoleModuleRegistry.ts', detail: 'explicit manifest imports' });
}
const workstationList = workstation.match(/const workstationModuleIds\s*=\s*\[([\s\S]*?)\]\s*as const/)?.[1] ?? '';
const workstationKeys = [...workstationList.matchAll(/'([^']+)'/g)].map((match) => match[1]);
for (const key of workstationKeys) {
  if (!moduleIds.includes(key)) violations.push({ code: 'CONSOLE_WORKSTATION_MODULE_MISSING', location: key, detail: 'registry owner' });
}
const professionalReferences = [
  ...professional.matchAll(/\bprojectRoute\(\s*'[^']+'\s*,\s*'([^']+)'\s*,\s*'([^']+)'/g),
  ...professional.matchAll(/\bregistryRoute\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/g),
].map((match) => ({ moduleId: match[1], routeId: match[2] }));
for (const { moduleId, routeId } of professionalReferences) {
  if (!moduleIds.includes(moduleId) || !routeIds.includes(routeId) || !routeId.startsWith(`${moduleId}.`)) {
    violations.push({ code: 'CONSOLE_PROFESSIONAL_ROUTE_MISSING', location: routeId, detail: moduleId });
  }
}
for (const { file, source } of [{ file: routerFile, source: routes }, ...manifests]) {
  for (const match of source.matchAll(/import\('([^']+)'\)/g)) {
    const target = resolveModule(dirname(file), match[1]);
    if (!target) violations.push({ code: 'CONSOLE_ROUTE_MODULE_MISSING', location: match[1], detail: file });
  }
}
if (/workstations|ResourceBoard|features\/workstation/.test(routes)) {
  violations.push({ code: 'CONSOLE_RETIRED_ROUTE_REGISTRY', location: 'apps/console/src/route/ConsoleRouter.tsx', detail: 'hard-cut semantic router required' });
}

if (existsSync(miniappManifest)) {
  const miniapp = JSON.parse(readFileSync(miniappManifest, 'utf8'));
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
}
report('navigation', violations);

function resolveModule(directory, specifier) {
  for (const suffix of ['.tsx', '.ts', '/index.tsx', '/index.ts']) {
    const candidate = resolve(directory, `${specifier}${suffix}`);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}
