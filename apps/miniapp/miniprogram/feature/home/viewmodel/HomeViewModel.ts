import { connectMiniappClient, defineMiniappFeature } from '../../../shared/FeatureViewModel';
import type { OperationOutputFor } from '@shop/contract';
import { displayItem, displayPage, money } from '../../../shared/Display';

export const homeViewModel = defineMiniappFeature({
  defaultRoute: 'miniapphome', routes: ['miniapphome'], title: '今日福利', description: '精选福利、账户与订单提醒一屏掌握。',
  bootstrap: true,
  connect: () => connectMiniappClient({}),
  project: (value) => {
    const source = value as OperationOutputFor<'storefront.bootstrap.read'>;
    const benefit = source.benefit.data;
    const orders = source.orders.data;
    return displayPage(
      benefit === null ? [] : [displayItem('benefit', '我的福利余额', `${benefit.accounts} 个福利账户 · 可用 ${money(benefit.availableMinor, benefit.currency ?? 'CNY')}`, source.benefit.state, source.benefit.asOf)],
      orders === null ? [] : [displayItem('orders', '我的订单提醒', `待付款 ${orders.awaitingPayment} 单 · 履约中 ${orders.fulfilling} 单 · 售后 ${orders.aftersale} 单`, source.orders.state, source.orders.asOf)]
    );
  },
});
