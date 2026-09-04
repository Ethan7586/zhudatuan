import { defineMiniappFeature } from '../../../shared/FeatureViewModel';

export const homeViewModel = defineMiniappFeature({
  defaultRoute: 'miniapphome', routes: ['miniapphome'], title: '今日福利', description: '精选福利、账户与订单提醒一屏掌握。',
  read: (client, context) => client.storefront.bootstrapRead({}, context),
});
