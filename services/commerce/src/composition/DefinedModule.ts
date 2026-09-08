import type { RegisteredOperationHandler } from '../pipeline/OperationHandler';
import type { ModuleJob } from '../pipeline/ModuleJob';
import type { ModuleEventSubscription } from '../pipeline/ModuleEvent';
import type { ModuleWorker } from '../pipeline/ModuleWorker';
import type { CommerceModule, ModuleContext, PublicPortBinding } from './ModuleRegistry';
import type { ModuleManifest } from './ModuleManifest';

export type PortFactory = (context: ModuleContext) => readonly PublicPortBinding[];
export interface ModuleAssembly {
  readonly handlers?: (context: ModuleContext) => readonly RegisteredOperationHandler[];
  readonly ports?: readonly PublicPortBinding[] | PortFactory;
  readonly jobPorts?: readonly PublicPortBinding[] | PortFactory;
  readonly providerPorts?: readonly PublicPortBinding[] | PortFactory;
  readonly jobs?: (context: ModuleContext) => readonly ModuleJob[];
  readonly providerJobs?: (context: ModuleContext) => readonly ModuleJob[];
  readonly workers?: (context: ModuleContext) => readonly ModuleWorker[];
  readonly events?: readonly ModuleEventSubscription[];
}

export function defineModule(manifest: ModuleManifest, assembly: ModuleAssembly): CommerceModule {
  const { id, dependencies, services, extensionCapabilities } = manifest;
  return Object.freeze({
    manifest,
    id,
    dependencies: Object.freeze([...dependencies]),
    services: Object.freeze([...services]),
    capabilities: Object.freeze([...extensionCapabilities]),
    dependenciesFor(workload: ModuleContext['workload']): readonly string[] {
      return manifest.workloads[workload].dependencies;
    },
    servicesFor(workload: ModuleContext['workload']): readonly string[] {
      return manifest.workloads[workload].services;
    },
    bindingsFor(workload: ModuleContext['workload']): readonly string[] {
      return manifest.workloads[workload].bindings;
    },
    workersFor(workload: ModuleContext['workload']): readonly string[] {
      return manifest.workloads[workload].workers;
    },
    bind(context: ModuleContext): readonly PublicPortBinding[] {
      const ports = context.workload === 'api' ? assembly.ports : context.workload === 'jobs' ? assembly.jobPorts : assembly.providerPorts;
      const bindings = ports ? [...(typeof ports === 'function' ? ports(context) : ports)] : [];
      assertExact(
        `${id}:${context.workload}:publicports`,
        bindings.map(({ token }) => token.key),
        manifest.workloads[context.workload].publicPorts
      );
      return Object.freeze(bindings);
    },
    register(context: ModuleContext): void {
      for (const subscription of assembly.events ?? []) context.events.add(subscription);
      if (context.workload === 'api') {
        const handlers = assembly.handlers?.(context) ?? [];
        assertExact(
          `${id}:api:operations`,
          handlers.map(({ operation }) => operation),
          manifest.operations
        );
        for (const handler of handlers) context.handlers.add(id, handler);
        return;
      }
      const factory = context.workload === 'provider' ? assembly.providerJobs : assembly.jobs;
      const jobs = factory?.(context) ?? [];
      assertExact(
        `${id}:${context.workload}:jobs`,
        jobs.map(({ id: job }) => job),
        manifest.workloads[context.workload].jobs
      );
      for (const job of jobs) context.jobs?.add(job);
      if (context.workload === 'jobs') {
        const workers = assembly.workers?.(context) ?? [];
        assertExact(
          `${id}:jobs:workers`,
          workers.map(({ id: worker }) => worker),
          manifest.workloads.jobs.workers
        );
        for (const worker of workers) context.workers?.add(worker);
      }
    },
  });
}

function assertExact(subject: string, actual: readonly string[], declared: readonly string[]): void {
  const actualSet = new Set(actual);
  const declaredSet = new Set(declared);
  if (actualSet.size !== actual.length) throw new Error(`MODULE_IMPLEMENTATION_DUPLICATE:${subject}`);
  const undeclared = actual.filter((value) => !declaredSet.has(value));
  if (undeclared.length > 0) throw new Error(`MODULE_IMPLEMENTATION_UNDECLARED:${subject}:${undeclared.sort().join(',')}`);
  const missing = declared.filter((value) => !actualSet.has(value));
  if (missing.length > 0) throw new Error(`MODULE_IMPLEMENTATION_MISSING:${subject}:${missing.sort().join(',')}`);
}
