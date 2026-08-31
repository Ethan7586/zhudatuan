import { COMMERCE_EVENTS, OperationCatalog } from '@shop/contract';
import { CONTRACT_SCHEMA_HEAD, TARGET_SCHEMA_HEAD } from '@shop/config/server';
import type { DatabasePool } from '../foundation/persistence/Pool';
import { Container } from './Container';
import type { ExtensionRegistry } from './ExtensionRegistry';
import { JobRegistry } from './JobRegistry';
import { registerProviders } from '../app/providers';

export interface ProviderBootstrapOptions {
  readonly extensions: ExtensionRegistry;
  readonly worker: string;
  readonly configure?: (container: Container) => void | Promise<void>;
}

export async function bootstrapProvider(options: ProviderBootstrapOptions): Promise<JobRegistry> {
  const container = new Container();
  await options.configure?.(container);
  const jobs = new JobRegistry();
  registerProviders(jobs, container, options.extensions, options.worker);
  jobs.freeze();
  options.extensions.freeze();
  container.freeze();
  return jobs;
}

export async function assertProviderReady(pool: DatabasePool, extensions: ExtensionRegistry): Promise<void> {
  const result = await pool.query<{ role: boolean; migration: boolean; contract: boolean; operations: number; events: number }>(
    `select current_user='shopprovider' role,
    exists(select 1 from runtime.schemaversion where version=$1) migration,
    exists(select 1 from runtime.schemaversion where version=$2) contract,
    (select count(*)::integer from runtime.operation) operations,
    (select count(*)::integer from runtime.event) events`,
    [TARGET_SCHEMA_HEAD, CONTRACT_SCHEMA_HEAD]
  );
  const state = result.rows[0];
  const health = await extensions.healthAll();
  if (!state?.role || !state.migration || !state.contract || state.operations !== OperationCatalog.all().length || state.events !== COMMERCE_EVENTS.length || health.some(({ state: value }) => value !== 'healthy')) {
    throw new Error('PROVIDER_RUNTIME_NOT_READY');
  }
}
