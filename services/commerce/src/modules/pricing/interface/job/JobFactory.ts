import type { ModuleJob } from '../../../../pipeline/ModuleJob';
import type { ModuleContext } from '../../../../composition/ModuleRegistry';
import { PROVIDER_CATALOG_PORT } from '../../../catalog/public';
import { PROVIDER_SYNC_PORT } from '../../../channel/public';
import { PROVIDER_PRICING_PORT } from '../../public';

export function createProviderJobs(context: ModuleContext): readonly ModuleJob[] {
  const channel = context.ports.get(PROVIDER_SYNC_PORT).price(context.ports.get(PROVIDER_CATALOG_PORT), context.ports.get(PROVIDER_PRICING_PORT));
  return Object.freeze([
    {
      id: 'pricesync',
      processor: channel,
      deadletter: channel,
    },
  ]);
}
