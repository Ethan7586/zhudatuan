import { publicPort } from '../../../composition/ModuleRegistry';
export interface ReferralCatalogPort {
  product(
    scopeId: string,
    productId: string
  ): Promise<Readonly<{
    productId: string;
    active: boolean;
    version: number;
  }> | null>;
}
export const REFERRAL_CATALOG_PORT = publicPort<ReferralCatalogPort>('catalog', 'referral');
