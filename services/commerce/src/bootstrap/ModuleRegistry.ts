import type { HandlerRegistry } from '../foundation/application/HandlerRegistry';
import type { Container, Token } from './Container';
import { EventRegistry } from './EventRegistry';
import { EVENT_HANDLERS } from '../generated/EventHandlers';

export interface PublicPortToken<T> {
  readonly key: string;
  readonly owner: string;
  readonly type?: T;
}

export function publicPort<T>(owner: string, name: string): PublicPortToken<T> {
  if (!/^[a-z]+$/.test(owner) || !/^[a-z][a-z0-9]*$/.test(name)) throw new Error(`PUBLIC_PORT_TOKEN_INVALID:${owner}:${name}`);
  return Object.freeze({ key: `${owner}.${name}`, owner });
}

export interface PublicPortBinding<T = unknown> {
  readonly token: PublicPortToken<T>;
  readonly value: T;
}

export class PublicPortRegistry {
  private readonly values = new Map<string, Readonly<{ owner: string; value: unknown }>>();
  private frozen = false;

  add<T>(module: string, binding: PublicPortBinding<T>): void {
    if (this.frozen) throw new Error('PUBLIC_PORT_REGISTRY_FROZEN');
    if (binding.token.owner !== module) throw new Error(`PUBLIC_PORT_OWNER_MISMATCH:${module}:${binding.token.key}`);
    if (this.values.has(binding.token.key)) throw new Error(`PUBLIC_PORT_DUPLICATE:${binding.token.key}`);
    this.values.set(binding.token.key, Object.freeze({ owner: module, value: binding.value }));
  }

  get<T>(requester: string, dependencies: readonly string[], token: PublicPortToken<T>): T {
    if (requester !== token.owner && !dependencies.includes(token.owner)) throw new Error(`PUBLIC_PORT_DEPENDENCY_UNDECLARED:${requester}:${token.owner}`);
    const binding = this.values.get(token.key);
    if (!binding) throw new Error(`PUBLIC_PORT_MISSING:${token.key}`);
    return binding.value as T;
  }

  resolve<T>(token: PublicPortToken<T>): T {
    if (!this.frozen) throw new Error('PUBLIC_PORT_REGISTRY_NOT_FROZEN');
    const binding = this.values.get(token.key);
    if (!binding) throw new Error(`PUBLIC_PORT_MISSING:${token.key}`);
    return binding.value as T;
  }

  freeze(): void {
    this.frozen = true;
  }
  catalog(): readonly string[] {
    return Object.freeze([...this.values.keys()].sort());
  }
}

export interface ModulePorts {
  get<T>(token: PublicPortToken<T>): T;
}

export interface ModuleContext {
  readonly workload: 'api' | 'jobs' | 'provider';
  readonly handlers: HandlerRegistry;
  readonly ports: ModulePorts;
  service<T>(token: Token<T>): T;
}
type ModuleLoadContext = Omit<ModuleContext, 'ports' | 'service'> & Readonly<{ container: Container }>;

export interface CommerceModule {
  readonly id: string;
  readonly dependencies: readonly string[];
  readonly services: readonly string[];
  bind(context: ModuleContext): readonly PublicPortBinding[];
  register(context: ModuleContext): void | Promise<void>;
}

export interface ModuleManifest {
  readonly id: string;
  readonly dependencies: readonly string[];
  readonly services: readonly string[];
}

export function defineModuleManifest(id: string, dependencies: readonly string[], services: readonly string[] = []): ModuleManifest {
  if (!/^[a-z]+$/.test(id) || dependencies.some((dependency) => !/^[a-z]+$/.test(dependency) || dependency === id)) {
    throw new Error(`MODULE_MANIFEST_INVALID:${id}`);
  }
  if (new Set(dependencies).size !== dependencies.length) throw new Error(`MODULE_DEPENDENCY_DUPLICATE:${id}`);
  if (services.some((service) => !/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)*$/.test(service))) throw new Error(`MODULE_SERVICE_INVALID:${id}`);
  if (new Set(services).size !== services.length) throw new Error(`MODULE_SERVICE_DUPLICATE:${id}`);
  return Object.freeze({ id, dependencies: Object.freeze([...dependencies]), services: Object.freeze([...services]) });
}

export class ModuleRegistry {
  private readonly modules = new Map<string, CommerceModule>();
  private readonly publicPorts = new PublicPortRegistry();
  private readonly eventSubscribers = new EventRegistry();
  private frozen = false;

  add(module: CommerceModule): void {
    if (this.frozen) throw new Error('MODULE_REGISTRY_FROZEN');
    if (this.modules.has(module.id)) throw new Error(`MODULE_DUPLICATE:${module.id}`);
    this.modules.set(module.id, module);
  }

  async load(context: ModuleLoadContext): Promise<void> {
    if (this.frozen) throw new Error('MODULE_REGISTRY_FROZEN');
    this.frozen = true;
    for (const [event, subscribers] of EVENT_HANDLERS) this.eventSubscribers.register(event, subscribers);
    for (const module of ordered(this.modules)) {
      const moduleContext: ModuleContext = {
        ...context,
        ports: Object.freeze({ get: <T>(token: PublicPortToken<T>) => this.publicPorts.get(module.id, module.dependencies, token) }),
        service: <T>(token: Token<T>) => {
          if (!module.services.includes(token.key)) throw new Error(`MODULE_SERVICE_UNDECLARED:${module.id}:${token.key}`);
          return context.container.get(token);
        },
      };
      for (const port of module.bind(moduleContext)) this.publicPorts.add(module.id, port);
      await module.register(moduleContext);
    }
    this.publicPorts.freeze();
    this.eventSubscribers.freeze();
  }

  catalog(): readonly string[] {
    return Object.freeze([...this.modules.keys()].sort());
  }

  portCatalog(): readonly string[] {
    return this.publicPorts.catalog();
  }
  port<T>(token: PublicPortToken<T>): T {
    if (!this.frozen) throw new Error('MODULE_REGISTRY_NOT_FROZEN');
    return this.publicPorts.resolve(token);
  }
  events(): EventRegistry {
    if (!this.frozen) throw new Error('MODULE_REGISTRY_NOT_FROZEN');
    return this.eventSubscribers;
  }
}

function ordered(modules: ReadonlyMap<string, CommerceModule>): readonly CommerceModule[] {
  const result: CommerceModule[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`MODULE_DEPENDENCY_CYCLE:${id}`);
    const module = modules.get(id);
    if (!module) throw new Error(`MODULE_DEPENDENCY_MISSING:${id}`);
    visiting.add(id);
    for (const dependency of module.dependencies) visit(dependency);
    visiting.delete(id);
    visited.add(id);
    result.push(module);
  };
  for (const id of modules.keys()) visit(id);
  return result;
}
