import { defineMiniappFeature } from '../../../shared/FeatureViewModel';

export const paymentViewModel = defineMiniappFeature({
  defaultRoute: 'miniapppayment', routes: ['miniapppayment'], title: '支付结果', description: '支付结果由服务端核验，未确认时不会显示成功。',
  read: (client, context, route) => {
    if (route.id !== 'miniapppayment') throw new Error('MINIAPP_PAYMENT_ROUTE_INVALID');
    return client.payment.intentsRead({ path: { paymentid: route.parameters.paymentId } }, context);
  },
});
