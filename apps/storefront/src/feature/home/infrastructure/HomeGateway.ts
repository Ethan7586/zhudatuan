import type { OperationOutputFor } from '@shop/contract';
import { storefrontClient } from '../../../shared/api/Client';

export const HomeGateway = Object.freeze({
  read(signal?: AbortSignal): Promise<OperationOutputFor<'storefront.bootstrap.read'>> {
    return storefrontClient.commerce.storefront.bootstrapRead({}, storefrontClient.context(null, { signal }));
  },
});
