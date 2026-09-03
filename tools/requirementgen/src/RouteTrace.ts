import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'yaml';

export interface RouteTrace {
  readonly id: string;
  readonly surface: 'auth' | 'console' | 'storefront';
  readonly path: string;
  readonly feature: string;
  readonly requirements: readonly string[];
  readonly manifest: string;
  readonly viewmodel: string;
  readonly test: string;
}

export async function loadRouteTraces(root: string): Promise<readonly RouteTrace[]> {
  const document = parse(await readFile(resolve(root, 'config/navigation.yml'), 'utf8')) as {
    readonly version?: number;
    readonly routes?: readonly Omit<RouteTrace, 'manifest' | 'viewmodel' | 'test'>[];
  };
  if (document.version !== 2 || !Array.isArray(document.routes)) throw new Error('ROUTE_CATALOG_INVALID');
  const keys = new Set<string>();
  return Object.freeze(
    document.routes.map((route) => {
      const key = `${route.surface}:${route.path}`;
      if (keys.has(key)) throw new Error(`ROUTE_TRACE_DUPLICATE:${key}`);
      keys.add(key);
      const rootPath = `apps/${route.surface}/src/feature/${route.feature}`;
      return Object.freeze({
        ...route,
        requirements: Object.freeze([...route.requirements]),
        manifest: `${rootPath}/Manifest.ts`,
        viewmodel: `${rootPath}/viewmodel`,
        test: `${rootPath}/viewmodel/${pascal(route.feature)}ViewModel.test.ts`,
      });
    })
  );
}

function pascal(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}
