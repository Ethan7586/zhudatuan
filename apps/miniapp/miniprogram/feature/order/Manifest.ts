import { defineMiniappManifest } from '../../shared/FeatureManifest';
import { orderViewModel } from './viewmodel/OrderViewModel';

export const OrderManifest = defineMiniappManifest('order', orderViewModel, [
  { routeid: 'miniapporders', title: '我的订单', breadcrumbs: ['我的', '我的订单'], load: () => import('./page') },
  { routeid: 'miniapporder', title: '订单详情', breadcrumbs: ['我的订单', '订单详情'], load: () => import('./page') },
]);
