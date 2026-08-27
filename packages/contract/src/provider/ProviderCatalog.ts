import type { ProviderPriority } from './Manifest';
import { PROVIDER_CATALOG_RECORDS } from '../RequirementCatalog.generated';

export type ProviderDelivery = 'required' | 'deferred-contract';

export interface ProviderRequirement {
  readonly id: string;
  readonly label: string;
  readonly priority: ProviderPriority;
  readonly delivery: ProviderDelivery;
  readonly vendor?: string;
}

export const PROVIDER_REQUIREMENTS: readonly ProviderRequirement[] = PROVIDER_CATALOG_RECORDS;

export const REQUIRED_PROVIDER_IDS = Object.freeze(PROVIDER_REQUIREMENTS.filter(({ delivery }) => delivery === 'required').map(({ id }) => id));
