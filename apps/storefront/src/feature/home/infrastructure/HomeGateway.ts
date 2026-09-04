import type { StorefrontOperations } from '@shop/sdk/storefront';
import type { RequestContextFactory } from '../../../shared/api/RequestContext';
import type { StorefrontBootstrap } from '../../../entity/session';

export class HomeGateway {
  constructor(
    private readonly storefront: StorefrontOperations,
    private readonly context: RequestContextFactory
  ) {}
  read(signal?: AbortSignal): Promise<StorefrontBootstrap> {
    return this.storefront.bootstrapRead({}, this.context(null, { signal }));
  }
}
