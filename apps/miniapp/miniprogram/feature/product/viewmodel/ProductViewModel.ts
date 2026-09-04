import { defineMiniappFeature } from '../../../shared/FeatureViewModel';

export const productViewModel = defineMiniappFeature({
  defaultRoute: 'miniappproduct', routes: ['miniappproduct'], title: '商品详情', description: '价格、库存与可售状态均来自当前实时商品快照。',
  read: (client, context, route) => {
    if (route.id !== 'miniappproduct') throw new Error('MINIAPP_PRODUCT_ROUTE_INVALID');
    return client.storefront.catalogRead({ query: { productId: route.parameters.productId } }, context);
  },
});
