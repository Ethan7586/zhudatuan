import { token } from '../../../../composition/Container';

export interface StorefrontConfig {
  readonly origin: string;
  readonly entryPath: string;
}

export const STOREFRONT_CONFIG = token<StorefrontConfig>('storefront.config');
