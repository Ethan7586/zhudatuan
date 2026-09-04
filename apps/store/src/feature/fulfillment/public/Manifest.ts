import { defineStoreFeature } from '../../../shared/FeatureManifest';

export const fulfillmentManifest = defineStoreFeature('fulfillment', [{ routeid: 'storefulfillment', title: '发货管理', breadcrumbs: ['门店工作台', '发货管理'], load: () => import('../route/FulfillmentRoute') }]);
