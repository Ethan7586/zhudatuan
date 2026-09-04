import { defineMiniappFeature } from '../../../shared/FeatureViewModel';

export const checkoutViewModel = defineMiniappFeature({
  defaultRoute: 'miniappcheckout', routes: ['miniappcheckout'], title: '确认订单', description: '地址、福利、卡券和应付金额以服务端报价为准。',
  read: (client, context) => client.checkout.quotesCurrentRead({}, context),
});
