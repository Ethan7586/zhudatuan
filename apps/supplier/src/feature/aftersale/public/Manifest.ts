import { defineSupplierFeature } from '../../../shared/FeatureManifest';

export const aftersaleManifest = defineSupplierFeature('return', [{ routeid: 'supplierreturns', title: '退货处理', breadcrumbs: ['供应链后台', '退货处理'], load: () => import('../route/AftersaleRoute') }]);
