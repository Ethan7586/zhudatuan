import { defineComponent } from '../../shared/manifest/ComponentManifest';

export const OrderManifest = defineComponent({
  component: 'order',
  navigationids: ['grouporder', 'mallorder'],
  load: () => import('./OrderRoute'),
  routes: [{ route: 'orders' }, { route: 'orders/:orderId', load: () => import('./OrderDetailRoute') }],
});
