import { defineMiniappFeature } from '../../../shared/FeatureViewModel';

export const catalogViewModel = defineMiniappFeature({
  defaultRoute: 'miniappcatalog', routes: ['miniappcatalog'], title: '选购福利', description: '查看当前商城已发布且可购买的商品。',
  read: (client, context) => client.storefront.catalogRead({ query: { limit: 30 } }, context),
});
