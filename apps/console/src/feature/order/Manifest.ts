import { defineComponent } from '../../shared/manifest/ComponentManifest';

export const OrderManifest = defineComponent({
  component: 'order',
  navigationids: ['grouporder', 'mallorder'],
  load: () => import('./route/OrderRoute'),
  routes: [{ routeid: 'consoleorders' }, { routeid: 'consoleorderdetail', load: () => import('./route/OrderDetailRoute') }],
});
