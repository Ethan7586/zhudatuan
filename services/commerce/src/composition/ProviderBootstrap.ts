import { COMMERCE_EVENTS, CONTRACT_VERSION, OperationCatalog } from '@shop/contract';
import { TARGET_SCHEMA_HEAD } from '@shop/config/server';
import type { DatabasePool } from '../platform/database/Pool';
import { Container } from './Container';
import type { ExtensionRegistry } from './ExtensionRegistry';
import { JobRegistry } from '../modules/runtime/application/registry/JobRegistry';
import { HandlerRegistry } from '../pipeline/HandlerRegistry';
import { ModuleRegistry, type CommerceModule } from './ModuleRegistry';

export interface ProviderBootstrapOptions {
  readonly modules: readonly CommerceModule[];
  readonly extensions: ExtensionRegistry;
  readonly worker: string;
  readonly configure?: (container: Container) => void | Promise<void>;
}

export async function bootstrapProvider(options: ProviderBootstrapOptions): Promise<JobRegistry> {
  const container = new Container();
  await options.configure?.(container);
  const jobs = new JobRegistry();
  const modules = new ModuleRegistry();
  for (const module of options.modules) modules.add(module);
  await modules.load({ workload: 'provider', container, handlers: new HandlerRegistry(), jobs, worker: options.worker });
  jobs.freeze();
  options.extensions.freeze();
  container.freeze();
  return jobs;
}

export async function assertProviderReady(pool: DatabasePool, extensions: ExtensionRegistry): Promise<void> {
  const result = await pool.query<{ role: boolean; migration: boolean; contract: boolean; operations: number; events: number }>(
    `select current_user='shopprovider' role,
    exists(select 1 from runtime.schemaversion where version=$1) migration,
    exists(select 1 from runtime.contractcatalog where artifact='commerce' and version=$2 and status='active'
      and operation_count=(select count(*) from runtime.operation)
      and event_count=(select count(*) from runtime.event where retired_at is null)) contract,
    (select count(*)::integer from runtime.operation) operations,
    (select count(*)::integer from runtime.event where retired_at is null) events`,
    [TARGET_SCHEMA_HEAD, CONTRACT_VERSION]
  );
  const state = result.rows[0];
  const health = await extensions.healthAll();
  if (!state?.role || !state.migration || !state.contract || state.operations !== OperationCatalog.all().length || state.events !== COMMERCE_EVENTS.length || health.some(({ state: value }) => value !== 'healthy')) {
    throw new Error('PROVIDER_RUNTIME_NOT_READY');
  }
}
