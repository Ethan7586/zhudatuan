import type { ModuleJob } from '../../../../foundation/application/ModuleJob';
import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import { PROVIDER_CATALOG_PORT } from '../../../catalog/public';
import { PROVIDER_SYNC_PORT } from '../../../channel/public';
import { PROVIDER_PRICING_PORT } from '../../public';

export function createProviderJobs(context: ModuleContext): readonly ModuleJob[] {
  return Object.freeze([
    {
      id: 'pricesync',
      processor: context.ports.get(PROVIDER_SYNC_PORT).price(context.ports.get(PROVIDER_CATALOG_PORT), context.ports.get(PROVIDER_PRICING_PORT)),
    },
  ]);
}
