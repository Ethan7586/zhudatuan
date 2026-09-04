import { defineMiniappFeature } from '../../../shared/FeatureViewModel';

export const cartViewModel = defineMiniappFeature({
  defaultRoute: 'miniappcart', routes: ['miniappcart'], title: '购物车', description: '核对商品数量与实时金额，再进入结算。',
  read: (client, context) => client.cart.currentRead({}, context),
});
