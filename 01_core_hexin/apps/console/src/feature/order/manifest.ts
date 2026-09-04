import type { ConsoleModuleManifest } from '../../entity/navigation/ConsoleModuleManifest';

export const ordersModule = {
  id: 'orders',
  status: 'enabled',
  navigation: { placement: 'main', group: 'commerce', order: 50, label: '订单管理系统', icon: 'orders' },
  routes: [
    {
      id: 'orders.index',
      path: 'orders',
      kind: 'entry',
      lazy: () => import('./OrderRoute'),
      operations: ['order.orders.read'],
      presentation: { title: '订单管理', summary: '订单、履约、售后和异常时间线' },
    },
    {
      id: 'orders.detail',
      path: 'orders/:orderId',
      kind: 'detail',
      lazy: () => import('./OrderDetailRoute'),
      operations: ['order.orders.read'],
      presentation: { title: '订单详情', summary: '订单、支付、履约和售后终态' },
    },
  ],
} as const satisfies ConsoleModuleManifest<'orders'>;
