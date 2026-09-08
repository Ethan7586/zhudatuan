import type { HandlerRegistry } from '../pipeline/HandlerRegistry';
import type { ModuleJobs } from '../pipeline/ModuleJob';
import type { ModuleEvents } from '../pipeline/ModuleEvent';
import type { ModuleWorkers } from '../pipeline/ModuleWorker';
import type { Container, Token } from './Container';
import { EventRegistry } from './EventRegistry';
import { EVENT_SCHEMA_TYPES } from '../generated/EventCatalog';
import { PROVIDER_JOB_IDS, jobDefinition } from '../pipeline/JobCatalog';
import type { JobRegistry } from '../modules/runtime/application/registry/JobRegistry';
import { JobAssembler } from './JobAssembler';
import type { WorkerRegistry } from '../modules/runtime/application/registry/WorkerRegistry';
import type { ModuleManifest } from './ModuleManifest';

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
  readonly worker?: string;
  readonly handlers: HandlerRegistry;
  readonly ports: ModulePorts;
  readonly jobs?: ModuleJobs;
  readonly workers?: ModuleWorkers;
  readonly events: ModuleEvents;
  service<T>(token: Token<T>): T;
}
type ModuleLoadContext = Omit<ModuleContext, 'ports' | 'jobs' | 'workers' | 'worker' | 'events' | 'service'> &
  Readonly<{
    container: Container;
    jobs?: JobRegistry;
    workers?: WorkerRegistry;
    worker?: string;
    batch?: number;
    poll?: number;
  }>;

export interface CommerceModule {
  readonly manifest: ModuleManifest;
  readonly id: string;
  readonly dependencies: readonly string[];
  readonly services: readonly string[];
  readonly capabilities?: readonly string[];
  dependenciesFor?(workload: ModuleContext['workload']): readonly string[];
  servicesFor?(workload: ModuleContext['workload']): readonly string[];
  bindingsFor?(workload: ModuleContext['workload']): readonly string[];
  workersFor?(workload: ModuleContext['workload']): readonly string[];
  bind(context: ModuleContext): readonly PublicPortBinding[];
  register(context: ModuleContext): void | Promise<void>;
}

export class ModuleRegistry {
  private readonly modules = new Map<string, CommerceModule>();
  private readonly capabilityOwners = new Map<string, string>();
  private readonly publicPorts = new PublicPortRegistry();
  private readonly eventSubscribers = new EventRegistry();
  private frozen = false;

  add(module: CommerceModule): void {
    if (this.frozen) throw new Error('MODULE_REGISTRY_FROZEN');
    if (module.manifest.id !== module.id) throw new Error(`MODULE_MANIFEST_ID_MISMATCH:${module.id}`);
    if (!same(module.manifest.dependencies, module.dependencies) || !same(module.manifest.services, module.services)) throw new Error(`MODULE_MANIFEST_REGISTRATION_MISMATCH:${module.id}`);
    if (!same(module.manifest.extensionCapabilities, module.capabilities ?? [])) throw new Error(`MODULE_MANIFEST_CAPABILITY_MISMATCH:${module.id}`);
    if (this.modules.has(module.id)) throw new Error(`MODULE_DUPLICATE:${module.id}`);
    for (const capability of module.capabilities ?? []) {
      const owner = this.capabilityOwners.get(capability);
      if (owner !== undefined) throw new Error(`MODULE_CAPABILITY_OWNER_DUPLICATE:${capability}:${owner}:${module.id}`);
    }
    this.modules.set(module.id, module);
    for (const capability of module.capabilities ?? []) this.capabilityOwners.set(capability, module.id);
  }

  async load(context: ModuleLoadContext): Promise<void> {
    if (this.frozen) throw new Error('MODULE_REGISTRY_FROZEN');
    this.frozen = true;
    for (const event of EVENT_SCHEMA_TYPES) this.eventSubscribers.declare(event);
    const jobAssembler = context.jobs
      ? new JobAssembler(context.jobs, context.container, required(context.worker, 'JOB_WORKER_REQUIRED'), context.workload === 'provider' ? 'provider' : 'jobs', context.batch ?? 100, context.poll ?? 1_000)
      : undefined;
    const modules = ordered(this.modules, context.workload);
    const moduleContext = (module: CommerceModule): ModuleContext => {
      const dependencies = module.dependenciesFor?.(context.workload) ?? module.dependencies;
      const services = module.servicesFor?.(context.workload) ?? module.services;
      return {
        workload: context.workload,
        ...(context.worker === undefined ? {} : { worker: context.worker }),
        handlers: context.handlers,
        events: Object.freeze({
          add: (subscription: import('../pipeline/ModuleEvent').ModuleEventSubscription) => {
            const definition = jobDefinition(subscription.handler);
            if (definition.owner !== module.id || providerJobIds.has(subscription.handler)) {
              throw new Error(`EVENT_HANDLER_OWNER_MISMATCH:${module.id}:${subscription.handler}`);
            }
            for (const event of subscription.events) this.eventSubscribers.subscribe(event, subscription.handler);
          },
          handlers: (event: string) => this.eventSubscribers.handlers(event),
        }),
        ports: Object.freeze({ get: <T>(token: PublicPortToken<T>) => this.publicPorts.get(module.id, dependencies, token) }),
        ...(jobAssembler === undefined ? {} : { jobs: Object.freeze({ add: (binding: import('../pipeline/ModuleJob').ModuleJob) => jobAssembler.add(module.id, binding) }) }),
        ...(context.workers === undefined
          ? {}
          : { workers: Object.freeze({ add: (binding: import('../pipeline/ModuleWorker').ModuleWorker) => context.workers!.register(module.id, module.workersFor?.(context.workload) ?? [], binding) }) }),
        service: <T>(token: Token<T>) => {
          if (!services.includes(token.key)) throw new Error(`MODULE_SERVICE_UNDECLARED:${module.id}:${token.key}`);
          return context.container.get(token);
        },
      };
    };
    if (context.workload === 'api') {
      for (const module of modules) for (const port of module.bind(moduleContext(module))) this.publicPorts.add(module.id, port);
      for (const module of modules) await module.register(moduleContext(module));
    } else {
      for (const module of modules) for (const port of module.bind(moduleContext(module))) this.publicPorts.add(module.id, port);
      for (const module of modules) await module.register(moduleContext(module));
    }
    this.publicPorts.freeze();
    this.eventSubscribers.freeze();
    jobAssembler?.assertComplete();
    context.workers?.freeze(modules.flatMap((module) => (module.workersFor?.(context.workload) ?? []).map((id) => ({ owner: module.id, id }))));
  }

  catalog(): readonly string[] {
    return Object.freeze([...this.modules.keys()].sort());
  }

  capabilityCatalog(): readonly string[] {
    return Object.freeze([...this.modules.values()].flatMap((module) => module.capabilities ?? []).sort());
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

const providerJobIds = new Set<string>(PROVIDER_JOB_IDS);

function same(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function required(value: string | undefined, code: string): string {
  if (!value) throw new Error(code);
  return value;
}

function ordered(modules: ReadonlyMap<string, CommerceModule>, workload: ModuleContext['workload']): readonly CommerceModule[] {
  const result: CommerceModule[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`MODULE_DEPENDENCY_CYCLE:${id}`);
    const module = modules.get(id);
    if (!module) throw new Error(`MODULE_DEPENDENCY_MISSING:${id}`);
    visiting.add(id);
    for (const dependency of module.bindingsFor?.(workload) ?? module.dependenciesFor?.(workload) ?? module.dependencies) visit(dependency);
    visiting.delete(id);
    visited.add(id);
    result.push(module);
  };
  for (const id of modules.keys()) visit(id);
  return result;
}
