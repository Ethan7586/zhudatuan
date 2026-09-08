import { OperationCatalog, type OperationId } from '@shop/contract';
import type { HttpRequest } from '../platform/http/HttpRequest';
import type { HttpResponse } from '../platform/http/HttpResponse';

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

  constructor(private readonly expectedOperations: readonly OperationId[] = OperationCatalog.all().map((operation) => operation.id)) {
    if (new Set(expectedOperations).size !== expectedOperations.length) throw new Error('ROUTE_EXPECTATION_DUPLICATE');
  }

  register(definition: RouteDefinition): void {
    if (this.frozen) throw new Error('ROUTE_REGISTRY_FROZEN');
    if (!this.expectedOperations.includes(definition.operation)) throw new Error(`ROUTE_OPERATION_FORBIDDEN:${definition.operation}`);
    const operation = OperationCatalog.get(definition.operation);
    if (this.routes.some((route) => route.method === operation.method && route.path === operation.path)) throw new Error(`ROUTE_DUPLICATE:${operation.method}:${operation.path}`);
    const compiled = compile(operation.path);
    this.routes.push({ ...definition, method: operation.method, path: operation.path, ...compiled });
  }

  freeze(): void {
    const registered = new Set(this.routes.map((route) => route.operation));
    const missing = this.expectedOperations.filter((operation) => !registered.has(operation));
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
