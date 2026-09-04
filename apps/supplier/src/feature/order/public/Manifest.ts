import { defineSupplierFeature } from '../../../shared/FeatureManifest';

export const orderManifest = defineSupplierFeature('order', [{ routeid: 'supplierorders', title: '订单处理', breadcrumbs: ['供应链后台', '订单处理'], load: () => import('../route/OrderRoute') }]);
