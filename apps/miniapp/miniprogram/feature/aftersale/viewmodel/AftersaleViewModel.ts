import { defineMiniappFeature } from '../../../shared/FeatureViewModel';

export const aftersaleViewModel = defineMiniappFeature({
  defaultRoute: 'miniappaftersale', routes: ['miniappaftersale'], title: '售后服务', description: '提交前先核对订单与当前可申请范围。',
  read: (client, context, route) => {
    if (route.id !== 'miniappaftersale') throw new Error('MINIAPP_AFTERSALE_ROUTE_INVALID');
    return client.order.aftersalesRead({ query: { order: route.parameters.orderId, limit: 30 } }, context);
  },
});
