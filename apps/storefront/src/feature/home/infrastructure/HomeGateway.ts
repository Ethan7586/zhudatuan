import type { OperationOutputFor } from '@shop/contract';
import type { StorefrontClient } from '../../../shared/api/Client';

export class HomeGateway {
  constructor(private readonly storefront: StorefrontClient['commerce']['storefront'], private readonly context: StorefrontClient['context']) {}
  read(signal?: AbortSignal): Promise<OperationOutputFor<'storefront.bootstrap.read'>> {
    return this.storefront.bootstrapRead({}, this.context(null, { signal }));
  }
}
