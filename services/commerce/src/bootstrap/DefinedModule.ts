import type { RegisteredOperationHandler } from '../foundation/application/OperationHandler';
import type { ModuleJob } from '../foundation/application/ModuleJob';
import type { ModuleEventSubscription } from '../foundation/application/ModuleEvent';
import type { CommerceModule, ModuleContext, ModuleManifest, PublicPortBinding } from './ModuleRegistry';

export type PortFactory = (context: ModuleContext) => readonly PublicPortBinding[];
export interface ModuleAssembly {
  readonly handlers?: (context: ModuleContext) => readonly RegisteredOperationHandler[];
  readonly ports?: readonly PublicPortBinding[] | PortFactory;
  readonly jobPorts?: readonly PublicPortBinding[] | PortFactory;
  readonly providerPorts?: readonly PublicPortBinding[] | PortFactory;
  readonly jobs?: (context: ModuleContext) => readonly ModuleJob[];
  readonly providerJobs?: (context: ModuleContext) => readonly ModuleJob[];
  readonly events?: readonly ModuleEventSubscription[];
}

export function defineModule(manifest: ModuleManifest, assembly: ModuleAssembly): CommerceModule {
  const { id, dependencies, services } = manifest;
  return Object.freeze({
    id,
    dependencies: Object.freeze([...dependencies]),
    services: Object.freeze([...services]),
    dependenciesFor(workload: ModuleContext['workload']): readonly string[] {
      return manifest.workloads[workload].dependencies;
    },
    servicesFor(workload: ModuleContext['workload']): readonly string[] {
      return manifest.workloads[workload].services;
    },
    bindingsFor(workload: ModuleContext['workload']): readonly string[] {
      return manifest.workloads[workload].bindings;
    },
    bind(context: ModuleContext): readonly PublicPortBinding[] {
      const ports = context.workload === 'api' ? assembly.ports : context.workload === 'jobs' ? assembly.jobPorts : assembly.providerPorts;
      if (!ports) return Object.freeze([]);
      return Object.freeze([...(typeof ports === 'function' ? ports(context) : ports)]);
    },
    register(context: ModuleContext): void {
      for (const subscription of assembly.events ?? []) context.events.add(subscription);
      if (context.workload === 'api') {
        for (const handler of assembly.handlers?.(context) ?? []) context.handlers.add(id, handler);
        return;
      }
      const factory = context.workload === 'provider' ? assembly.providerJobs : assembly.jobs;
      for (const job of factory?.(context) ?? []) context.jobs?.add(job);
    },
  });
}
