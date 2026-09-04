import { defineStoreFeature } from '../../../shared/FeatureManifest';

export const orderManifest = defineStoreFeature('order', [
  { routeid: 'storeorderswork', title: '接单与备货', breadcrumbs: ['门店工作台', '接单与备货'], load: () => import('../route/OrderRoute') },
  { routeid: 'storeorderwork', title: '订单详情', breadcrumbs: ['接单与备货', '订单详情'], load: () => import('../route/OrderRoute') },
]);
