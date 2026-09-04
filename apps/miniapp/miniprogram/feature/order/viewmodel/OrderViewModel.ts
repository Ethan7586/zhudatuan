import { defineMiniappFeature } from '../../../shared/FeatureViewModel';

export const orderViewModel = defineMiniappFeature({
  defaultRoute: 'miniapporders', routes: ['miniapporders', 'miniapporder'], title: '我的订单', description: '查看订单状态、履约进度与售后入口。',
  read: (client, context, route) => route.id === 'miniapporder'
    ? client.order.detailRead({ path: { orderid: route.parameters.orderId } }, context)
    : client.order.ordersRead({ query: { limit: 30 } }, context),
});
