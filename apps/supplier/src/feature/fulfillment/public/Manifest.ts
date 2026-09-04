import { defineSupplierFeature } from '../../../shared/FeatureManifest';

export const fulfillmentManifest = defineSupplierFeature('fulfillment', [{ routeid: 'suppliershipments', title: '发货管理', breadcrumbs: ['供应链后台', '发货管理'], load: () => import('../route/FulfillmentRoute') }]);
