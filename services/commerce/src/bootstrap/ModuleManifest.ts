import { COMMERCE_EVENTS, COMMERCE_OPERATIONS } from '@shop/contract';
import { JOB_CATALOG, PROVIDER_JOB_IDS } from '../foundation/application/JobCatalog';
import type { PublicPortToken } from './ModuleRegistry';

export type ModuleWorkload = 'api' | 'jobs' | 'provider';

export interface ModuleConfigurationSchema {
  readonly id: string;
  readonly required: readonly string[];
  readonly additionalProperties: false;
}

export interface WorkloadDefinition {
  readonly dependencies: readonly string[];
  readonly bindings: readonly string[];
  readonly services: readonly string[];
  readonly workers: readonly string[];
  readonly jobs: readonly string[];
  readonly publicPorts: readonly string[];
  readonly configuration: ModuleConfigurationSchema;
}

export interface ModuleManifest {
  readonly id: string;
  readonly dependencies: readonly string[];
  readonly services: readonly string[];
  readonly operations: readonly string[];
  readonly events: readonly string[];
  readonly jobs: readonly string[];
  readonly publicPorts: readonly string[];
  readonly extensionCapabilities: readonly string[];
  readonly workloads: Readonly<Record<ModuleWorkload, Readonly<WorkloadDefinition>>>;
}

export interface WorkloadManifest {
  readonly dependencies?: readonly string[];
  readonly bindings?: readonly string[];
  readonly services?: readonly string[];
  readonly workers?: readonly string[];
  readonly ports?: readonly PublicPortToken<unknown>[];
}

export interface ModuleManifestInput {
  readonly id: string;
  readonly dependencies?: readonly string[];
  readonly services?: readonly string[];
  readonly capabilities?: readonly string[];
  readonly ports?: readonly PublicPortToken<unknown>[];
  readonly workloads?: Readonly<{ jobs?: WorkloadManifest; provider?: WorkloadManifest }>;
}

export function defineModuleManifest(input: ModuleManifestInput): ModuleManifest {
  const dependencies = input.dependencies ?? [];
  const services = input.services ?? [];
  const capabilities = input.capabilities ?? [];
  validateManifest(input.id, dependencies, services, capabilities);
  const api = workloadDefinition(input.id, 'api', { dependencies, bindings: dependencies, services, ...(input.ports === undefined ? {} : { ports: input.ports }) });
  const jobs = workloadDefinition(input.id, 'jobs', input.workloads?.jobs);
  const provider = workloadDefinition(input.id, 'provider', input.workloads?.provider);
  const operations = ownedOperations(input.id);
  const events = ownedEvents(input.id);
  const moduleJobs = Object.freeze([...jobs.jobs, ...provider.jobs].sort());
  const publicPorts = Object.freeze(uniqueSorted([...api.publicPorts, ...jobs.publicPorts, ...provider.publicPorts]));
  return Object.freeze({
    id: input.id,
    dependencies: api.dependencies,
    services: api.services,
    operations,
    events,
    jobs: moduleJobs,
    publicPorts,
    extensionCapabilities: Object.freeze([...capabilities]),
    workloads: Object.freeze({ api, jobs, provider }),
  });
}

function workloadDefinition(id: string, workload: ModuleWorkload, input: WorkloadManifest = {}): Readonly<WorkloadDefinition> {
  const dependencies = input.dependencies ?? [];
  const bindings = input.bindings ?? [];
  const services = input.services ?? [];
  const workers = input.workers ?? [];
  const publicPorts = (input.ports ?? []).map(({ key, owner }) => {
    if (owner !== id) throw new Error(`MODULE_PUBLIC_PORT_OWNER_MISMATCH:${id}:${key}`);
    return key;
  });
  if (dependencies.some((dependency) => !modulePattern.test(dependency) || dependency === id)) throw new Error(`MODULE_MANIFEST_INVALID:${id}`);
  assertUnique(dependencies, `MODULE_DEPENDENCY_DUPLICATE:${id}`);
  if (bindings.some((dependency) => !dependencies.includes(dependency))) throw new Error(`MODULE_BINDING_DEPENDENCY_UNDECLARED:${id}`);
  assertUnique(bindings, `MODULE_BINDING_DEPENDENCY_DUPLICATE:${id}`);
  if (services.some((service) => !servicePattern.test(service))) throw new Error(`MODULE_SERVICE_INVALID:${id}`);
  assertUnique(services, `MODULE_SERVICE_DUPLICATE:${id}`);
  if (workers.some((worker) => !workerPattern.test(worker))) throw new Error(`MODULE_WORKER_INVALID:${id}`);
  assertUnique(workers, `MODULE_WORKER_DUPLICATE:${id}`);
  assertUnique(publicPorts, `MODULE_PUBLIC_PORT_DUPLICATE:${id}:${workload}`);
  const jobs = ownedJobs(id, workload);
  return Object.freeze({
    dependencies: Object.freeze([...dependencies]),
    bindings: Object.freeze([...bindings]),
    services: Object.freeze([...services]),
    workers: Object.freeze([...workers]),
    jobs,
    publicPorts: Object.freeze([...publicPorts].sort()),
    configuration: Object.freeze({ id: `${id}.${workload}.configuration`, required: Object.freeze([...services].sort()), additionalProperties: false }),
  });
}

function validateManifest(id: string, dependencies: readonly string[], services: readonly string[], capabilities: readonly string[]): void {
  if (!modulePattern.test(id) || dependencies.some((dependency) => !modulePattern.test(dependency) || dependency === id)) throw new Error(`MODULE_MANIFEST_INVALID:${id}`);
  assertUnique(dependencies, `MODULE_DEPENDENCY_DUPLICATE:${id}`);
  if (services.some((service) => !servicePattern.test(service))) throw new Error(`MODULE_SERVICE_INVALID:${id}`);
  assertUnique(services, `MODULE_SERVICE_DUPLICATE:${id}`);
  if (capabilities.some((capability) => !capabilityPattern.test(capability))) throw new Error(`MODULE_CAPABILITY_INVALID:${id}`);
  assertUnique(capabilities, `MODULE_CAPABILITY_DUPLICATE:${id}`);
}

function ownedOperations(id: string): readonly string[] {
  return Object.freeze(COMMERCE_OPERATIONS.filter(({ module }) => module === id).map(({ id: operation }) => operation).sort());
}

function ownedEvents(id: string): readonly string[] {
  return Object.freeze(COMMERCE_EVENTS.filter(({ module }) => module === id).map(({ type }) => type).sort());
}

function ownedJobs(id: string, workload: ModuleWorkload): readonly string[] {
  if (workload === 'api') return Object.freeze([]);
  const provider = new Set<string>(PROVIDER_JOB_IDS);
  return Object.freeze(JOB_CATALOG.filter(({ owner, id: job }) => owner === id && provider.has(job) === (workload === 'provider')).map(({ id: job }) => job).sort());
}

function assertUnique(values: readonly string[], code: string): void {
  if (new Set(values).size !== values.length) throw new Error(code);
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

const modulePattern = /^[a-z]+$/;
const servicePattern = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)*$/;
const capabilityPattern = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/;
const workerPattern = /^[a-z][a-z0-9]*$/;
