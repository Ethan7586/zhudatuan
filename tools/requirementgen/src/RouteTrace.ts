import { readFile, readdir } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { parse } from 'yaml';

export interface RouteTrace {
  readonly id: string;
  readonly surface: 'auth' | 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier';
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
  const manifests = await manifestCatalog(root);
  const keys = new Set<string>();
  return Object.freeze(await Promise.all(
    document.routes.map(async (route) => {
      const key = `${route.surface}:${route.path}`;
      if (keys.has(key)) throw new Error(`ROUTE_TRACE_DUPLICATE:${key}`);
      keys.add(key);
      const candidates = manifests.filter((manifest) => manifest.surface === route.surface && includesRoute(manifest.source, route.id));
      if (candidates.length !== 1) throw new Error(`ROUTE_TRACE_MANIFEST_INVALID:${route.id}:${candidates.length}`);
      const manifest = candidates[0]!;
      const routeFile = await routeSource(root, manifest, route.id);
      const viewmodel = await viewModelSource(root, routeFile, manifest.path, route.feature);
      const test = await testSource(root, manifest.path, viewmodel, routeFile.path);
      return Object.freeze({
        ...route,
        requirements: Object.freeze([...route.requirements]),
        manifest: manifest.path,
        viewmodel,
        test,
      });
    })
  ));
}

interface ManifestSource { readonly surface: RouteTrace['surface']; readonly path: string; readonly source: string }
interface LoadedSource { readonly path: string; readonly source: string }

async function manifestCatalog(root: string): Promise<readonly ManifestSource[]> {
  const result: ManifestSource[] = [];
  const clients = await clientCatalog(root);
  for (const surface of ['auth', 'console', 'storefront', 'miniapp', 'store', 'supplier'] as const) {
    const client = clients.get(surface);
    if (client === undefined) throw new Error(`ROUTE_TRACE_CLIENT_MISSING:${surface}`);
    const directory = resolve(root, client.path, client.sourceRoot, 'feature');
    if (outside(root, directory)) throw new Error(`ROUTE_TRACE_CLIENT_ROOT_INVALID:${surface}`);
    for (const file of await files(directory, 'Manifest.ts')) {
      result.push({ surface, path: portable(relative(root, file)), source: await readFile(file, 'utf8') });
    }
  }
  return Object.freeze(result);
}

async function clientCatalog(root: string): Promise<ReadonlyMap<RouteTrace['surface'], Readonly<{ path: string; sourceRoot: string }>>> {
  const document = parse(await readFile(resolve(root, 'config/clients.yml'), 'utf8')) as {
    readonly version?: number;
    readonly clients?: readonly Readonly<{ id?: string; path?: string; sourceRoot?: string }>[];
  };
  if (document.version !== 1 || !Array.isArray(document.clients)) throw new Error('ROUTE_TRACE_CLIENT_CATALOG_INVALID');
  const clients = new Map<RouteTrace['surface'], Readonly<{ path: string; sourceRoot: string }>>();
  for (const client of document.clients) {
    if (!isSurface(client.id)) continue;
    if (typeof client.path !== 'string' || client.path.length === 0 || typeof client.sourceRoot !== 'string' || client.sourceRoot.length === 0) {
      throw new Error(`ROUTE_TRACE_CLIENT_INVALID:${client.id}`);
    }
    if (clients.has(client.id)) throw new Error(`ROUTE_TRACE_CLIENT_DUPLICATE:${client.id}`);
    clients.set(client.id, Object.freeze({ path: client.path, sourceRoot: client.sourceRoot }));
  }
  return clients;
}

function isSurface(value: string | undefined): value is RouteTrace['surface'] {
  return value === 'auth' || value === 'console' || value === 'storefront' || value === 'miniapp' || value === 'store' || value === 'supplier';
}

function outside(root: string, target: string): boolean {
  const path = relative(root, target);
  return path === '..' || path.startsWith('../') || path.startsWith('..\\');
}

function includesRoute(source: string, routeid: string): boolean {
  return new RegExp(`routeid\\s*:\\s*['"]${escape(routeid)}['"]`).test(source);
}

async function routeSource(root: string, manifest: ManifestSource, routeid: string): Promise<LoadedSource> {
  const position = manifest.source.search(new RegExp(`routeid\\s*:\\s*['"]${escape(routeid)}['"]`));
  const end = manifest.source.indexOf('}', position);
  const local = manifest.source.slice(position, end < 0 ? undefined : end + 1).match(/load\s*:\s*\(\)\s*=>\s*import\(['"]([^'"]+)['"]\)/)?.[1];
  const fallback = manifest.source.match(/load\s*:\s*\(\)\s*=>\s*import\(['"]([^'"]+)['"]\)/)?.[1];
  const specifier = local ?? fallback;
  if (!specifier) throw new Error(`ROUTE_TRACE_LOADER_MISSING:${routeid}`);
  const base = resolve(root, dirname(manifest.path), specifier);
  for (const extension of ['.tsx', '.ts']) {
    try {
      const source = await readFile(base + extension, 'utf8');
      return { path: portable(relative(root, base + extension)), source };
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause;
    }
  }
  throw new Error(`ROUTE_TRACE_ROUTE_MISSING:${routeid}:${specifier}`);
}

async function viewModelSource(root: string, route: LoadedSource, manifest: string, feature: string): Promise<string> {
  const imports = [...route.source.matchAll(/from\s+['"]([^'"]*\/viewmodel\/[^'"]*ViewModel)['"]/g)].map((match) => match[1]!);
  if (imports.length > 0) return portable(relative(root, resolve(root, dirname(route.path), imports[0]! + '.ts')));
  const candidates = (await files(resolve(root, dirname(manifest), 'viewmodel'))).filter((file) => file.endsWith('ViewModel.ts')).sort();
  const preferred = candidates.find((file) => file.endsWith(`/${pascal(feature)}ViewModel.ts`)) ?? candidates[0];
  if (!preferred) throw new Error(`ROUTE_TRACE_VIEWMODEL_MISSING:${route.path}`);
  return portable(relative(root, preferred));
}

async function testSource(root: string, manifest: string, viewmodel: string, route: string): Promise<string> {
  const direct = [viewmodel.replace(/\.ts$/, '.test.ts'), viewmodel.replace(/\.ts$/, '.test.tsx'), route.replace(/\.tsx?$/, '.test.tsx'), route.replace(/\.tsx?$/, '.test.ts')];
  for (const candidate of direct) {
    try { await readFile(resolve(root, candidate), 'utf8'); return candidate; }
    catch (cause) { if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause; }
  }
  const feature = dirname(manifest);
  const candidates = (await files(resolve(root, feature))).filter((file) => /\.(?:test|spec)\.(?:ts|tsx)$/.test(file)).sort();
  if (candidates.length === 0) throw new Error(`ROUTE_TRACE_TEST_MISSING:${route}`);
  return portable(relative(root, candidates[0]!));
}

async function files(directory: string, exactName?: string, result: string[] = []): Promise<readonly string[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return result;
    throw cause;
  }
  for (const entry of entries) {
    const target = resolve(directory, entry.name);
    if (entry.isDirectory()) await files(target, exactName, result);
    else if (entry.isFile() && (!exactName || entry.name === exactName)) result.push(target);
  }
  return result;
}

function portable(value: string): string { return value.split('\\').join('/'); }
function pascal(value: string): string { return value.slice(0, 1).toUpperCase() + value.slice(1); }
function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
