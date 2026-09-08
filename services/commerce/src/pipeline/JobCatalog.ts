import { CORE_JOB_CATALOG } from './CoreJobCatalog';
import { WORKFLOW_JOB_CATALOG } from './WorkflowJobCatalog';
import type { JobCatalogEntry } from './JobPolicy';
export type { JobCatalogEntry } from './JobPolicy';

export const JOB_CATALOG = Object.freeze([...CORE_JOB_CATALOG, ...WORKFLOW_JOB_CATALOG] as const satisfies readonly JobCatalogEntry[]);

export type JobKind = (typeof JOB_CATALOG)[number]['id'];

export const PROVIDER_JOB_IDS = Object.freeze(['catalogsync', 'pricesync', 'inventorysync', 'statementsync', 'channelwebhook', 'fulfillment', 'tracking', 'extensionhealth'] as const satisfies readonly JobKind[]);
export type ProviderJobKind = (typeof PROVIDER_JOB_IDS)[number];
const providerJobs = new Set<JobKind>(PROVIDER_JOB_IDS);
export const PROVIDER_JOB_CATALOG = Object.freeze(JOB_CATALOG.filter(({ id }) => providerJobs.has(id))) as readonly (JobCatalogEntry & { readonly id: ProviderJobKind })[];
export const ORDINARY_JOB_CATALOG = Object.freeze(JOB_CATALOG.filter(({ id }) => !providerJobs.has(id)));

export function jobDefinition(id: JobKind): JobCatalogEntry {
  const definition = JOB_CATALOG.find((candidate) => candidate.id === id);
  if (!definition) throw new Error(`JOB_CONFIGURATION_MISSING:${id}`);
  return definition;
}

if (new Set(JOB_CATALOG.map(({ id }) => id)).size !== JOB_CATALOG.length) throw new Error('JOB_CATALOG_DUPLICATE');
if (PROVIDER_JOB_CATALOG.length !== PROVIDER_JOB_IDS.length || ORDINARY_JOB_CATALOG.length + PROVIDER_JOB_CATALOG.length !== JOB_CATALOG.length) throw new Error('JOB_WORKLOAD_CATALOG_INVALID');
