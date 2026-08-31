import { OperationCatalog, type OperationId } from '@shop/contract';
import type { HttpRequest } from '../foundation/interface/HttpRequest';
import type { HttpResponse } from '../foundation/interface/HttpResponse';

export type RouteHandler = (request: HttpRequest) => Promise<HttpResponse>;

export interface RouteDefinition {
  readonly operation: OperationId;
  readonly handler: RouteHandler;
}

interface RegisteredRoute extends RouteDefinition {
  readonly method: string;
  readonly path: string;
  readonly pattern: RegExp;
  readonly parameters: readonly string[];
}

export class RouteRegistry {
  private readonly routes: RegisteredRoute[] = [];
  private frozen = false;
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  private readonly allowed: ReadonlySet<OperationId> | null;

  constructor(allowed?: readonly OperationId[]) {
    this.allowed = allowed === undefined ? null : new Set(allowed);
  }

  register(definition: RouteDefinition): void {
    if (this.frozen) throw new Error('ROUTE_REGISTRY_FROZEN');
    if (this.allowed !== null && !this.allowed.has(definition.operation)) return;
<<<<<<< HEAD
=======

  register(definition: RouteDefinition): void {
    if (this.frozen) throw new Error('ROUTE_REGISTRY_FROZEN');
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
    const operation = OperationCatalog.get(definition.operation);
    if (this.routes.some((route) => route.method === operation.method && route.path === operation.path)) throw new Error(`ROUTE_DUPLICATE:${operation.method}:${operation.path}`);
    const compiled = compile(operation.path);
    this.routes.push({ ...definition, method: operation.method, path: operation.path, ...compiled });
  }

  freeze(): void {
    const registered = new Set(this.routes.map((route) => route.operation));
<<<<<<< HEAD
<<<<<<< HEAD
    const expected = this.allowed === null ? OperationCatalog.all().map(({ id }) => id) : [...this.allowed];
    const missing = expected.filter((operation) => !registered.has(operation));
=======
    const missing = OperationCatalog.all().filter((operation) => !registered.has(operation.id)).map((operation) => operation.id);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
    const expected = this.allowed === null ? OperationCatalog.all().map(({ id }) => id) : [...this.allowed];
    const missing = expected.filter((operation) => !registered.has(operation));
>>>>>>> 018b2a71 (chore(release): capture current production source)
    if (missing.length > 0) throw new Error(`ROUTE_OPERATIONS_MISSING:${missing.join(',')}`);
    this.frozen = true;
    Object.freeze(this.routes);
  }

  match(method: string, path: string): Readonly<{ operation: OperationId; handler: RouteHandler; parameters: Readonly<Record<string, string>> }> | null {
    if (!this.frozen) throw new Error('ROUTE_REGISTRY_NOT_FROZEN');
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = route.pattern.exec(path);
      if (!match) continue;
      const parameters = Object.fromEntries(route.parameters.map((name, index) => [name, decodeURIComponent(match[index + 1]!)]));
      return { operation: route.operation, handler: route.handler, parameters };
    }
    return null;
  }

  catalog(): readonly Readonly<{ operation: OperationId; method: string; path: string }>[] {
    return this.routes.map(({ operation, method, path }) => ({ operation, method, path }));
  }
}

function compile(path: string): Readonly<{ pattern: RegExp; parameters: readonly string[] }> {
  const parameters: string[] = [];
  const source = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{([a-z]+)\\\}/g, (_match, name: string) => {
    parameters.push(name);
    return '([^/]+)';
  });
  return { pattern: new RegExp(`^${source}$`), parameters: Object.freeze(parameters) };
}
