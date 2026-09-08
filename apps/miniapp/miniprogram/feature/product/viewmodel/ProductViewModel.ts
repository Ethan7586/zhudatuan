import { bindCurrentRead, bindItemsPut } from '@shop/sdk/cart';
import { bindFavoritesPut } from '@shop/sdk/member';
import { bindCatalogRead } from '@shop/sdk/storefront';
import { connectMiniappClient, defineMiniappFeature } from '../../../shared/FeatureViewModel';
import type { OperationOutputFor } from '@shop/contract';
import { actionField, requiredInteger } from '@shop/presentation/actions';
import { miniappPagePath } from '../../../generated/PageBinding';
import { displayItem, displayPage, money } from '../../../shared/Display';

export const productViewModel = defineMiniappFeature({
  defaultRoute: 'miniappproduct', routes: ['miniappproduct'], title: '商品详情', description: '价格、库存与可售状态均来自当前实时商品快照。',
  connect: (executor) => connectMiniappClient({
    storefront: { catalogRead: bindCatalogRead(executor) },
    cart: { currentRead: bindCurrentRead(executor), itemsPut: bindItemsPut(executor) },
    member: { favoritesPut: bindFavoritesPut(executor) },
  }),
  read: (client, context, route) => {
    if (route.id !== 'miniappproduct') throw new Error('MINIAPP_PRODUCT_ROUTE_INVALID');
    return client.storefront.catalogRead({ query: { productId: route.parameters.productId } }, context);
  },
  project: (value) => {
    const item = product(value);
    return displayPage(item === undefined ? [] : [displayItem(
      item.id, item.title,
      `${item.subtitle ?? item.category.name} · ${item.price === null ? '价格核算中' : money(item.price.amountMinor, item.price.currency)} · ${item.availability?.available ?? 0} 件可用`,
      item.saleability.state, item.updatedAt
    )]);
  },
  actions: (value) => {
    const item = product(value);
    if (item === undefined || item.saleability.state !== 'saleable') return [];
    return [
      Object.freeze({ id: 'cartadd', label: '加入购物车', description: '数量和金额会在购物车中按服务端最新结果再次核对。', tone: 'primary' as const, fields: [actionField('quantity', '购买数量', { kind: 'number', placeholder: '1', maximumLength: 3 })] }),
      Object.freeze({ id: 'favorite', label: '收藏商品', description: '收藏后可在“我的”中继续查看。', tone: 'secondary' as const, fields: [] }),
    ];
  },
  execute: async (client, context, _route, value, action, input) => {
    const item = product(value);
    if (item === undefined) throw new Error('MINIAPP_PRODUCT_MISSING');
    if (action.id === 'favorite') {
      await client.member.favoritesPut({ path: { listingid: item.id }, body: { favorite: true } }, context);
      return { message: '商品已收藏。' };
    }
    if (action.id !== 'cartadd') throw new Error('MINIAPP_PRODUCT_ACTION_INVALID');
    const cart = await client.cart.currentRead({}, context);
    await client.cart.itemsPut(
      { path: { listingid: item.id }, body: { quantity: requiredInteger(input, 'quantity', 1, 999), lineVersion: null, selected: true } },
      Object.freeze({ ...context, expectedVersion: cart.version })
    );
    return { message: '已加入购物车。', destination: miniappPagePath('miniappcart') };
  },
});

function product(value: unknown): OperationOutputFor<'storefront.catalog.read'>['items'][number] | undefined {
  return (value as OperationOutputFor<'storefront.catalog.read'>).items[0];
}
