import { defineSupplierFeature } from '../../../shared/FeatureManifest';

export const pricingManifest = defineSupplierFeature('pricing', [{ routeid: 'supplierpricing', title: '价格管理', breadcrumbs: ['供应链后台', '价格管理'], load: () => import('../route/PricingRoute') }]);
