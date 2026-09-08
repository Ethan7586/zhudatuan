import { bindCatalogRead } from '@shop/sdk/storefront';
import { connectMiniappClient, defineMiniappFeature } from '../../../shared/FeatureViewModel';
import type { OperationOutputFor } from '@shop/contract';
import { miniappPagePath } from '../../../generated/PageBinding';
import { displayItem, displayPage, money } from '../../../shared/Display';

export const catalogViewModel = defineMiniappFeature({
  defaultRoute: 'miniappcatalog', routes: ['miniappcatalog'], title: '选购福利', description: '查看当前商城已发布且可购买的商品。',
  connect: (executor) => connectMiniappClient({ storefront: { catalogRead: bindCatalogRead(executor) } }),
  read: (client, context) => client.storefront.catalogRead({ query: { limit: 30 } }, context),
  project: (value) => {
    const source = value as OperationOutputFor<'storefront.catalog.read'>;
    return displayPage(source.items.map((item) => displayItem(
      item.id, item.title, `${item.subtitle ?? item.category.name} · ${item.price === null ? '价格核算中' : money(item.price.amountMinor, item.price.currency)}`,
      item.saleability.state, item.updatedAt
    )));
  },
  destination: (value, _route, record) => {
    const item = (value as OperationOutputFor<'storefront.catalog.read'>).items.find((candidate) => candidate.id === record || candidate.product === record);
    return item === undefined ? undefined : miniappPagePath('miniappproduct', { productId: item.product });
  },
});
