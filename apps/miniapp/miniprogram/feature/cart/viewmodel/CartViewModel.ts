import { bindCurrentRead, bindItemsPut } from '@shop/sdk/cart';
import { connectMiniappClient, defineMiniappFeature } from '../../../shared/FeatureViewModel';
import type { OperationOutputFor } from '@shop/contract';
import { actionField, requiredInteger } from '@shop/presentation/actions';
import { miniappPagePath } from '../../../generated/PageBinding';
import { displayItem, displayPage, money } from '../../../shared/Display';

export const cartViewModel = defineMiniappFeature({
  defaultRoute: 'miniappcart', routes: ['miniappcart'], title: '购物车', description: '核对商品数量与实时金额，再进入结算。',
  connect: (executor) => connectMiniappClient({ cart: { currentRead: bindCurrentRead(executor), itemsPut: bindItemsPut(executor) } }),
  read: (client, context) => client.cart.currentRead({}, context),
  project: (value) => {
    const source = value as OperationOutputFor<'cart.current.read'>;
    return displayPage(source.items.map((item) => displayItem(
      item.listing, item.title,
      `${item.quantity} 件 · ${item.amountMinor === null ? '金额待核算' : money(item.amountMinor, item.currency ?? 'CNY')} · ${item.selected ? '已选择' : '未选择'}`,
      item.validity.state, source.updated_at
    )));
  },
  actions: (value) => {
    const cart = value as OperationOutputFor<'cart.current.read'>;
    const changes = cart.items.map((item, index) => Object.freeze({
      id: `quantity:${index}`,
      label: `调整“${item.title}”`,
      description: `当前数量 ${item.quantity}，输入 0 可移出购物车。`,
      tone: 'secondary' as const,
      expectedVersion: cart.version,
      fields: [actionField('quantity', '新数量', { kind: 'number', placeholder: String(item.quantity), maximumLength: 3 })],
    }));
    return [...changes, ...(cart.items.some(({ selected }) => selected) ? [Object.freeze({ id: 'checkout', label: '去结算', description: '进入结算后会重新核对库存、价格、福利与卡券。', tone: 'primary' as const, fields: [] })] : [])];
  },
  execute: async (client, context, _route, value, action, input) => {
    if (action.id === 'checkout') return { message: '正在进入结算。', destination: miniappPagePath('miniappcheckout') };
    const match = /^quantity:(\d+)$/.exec(action.id);
    const cart = value as OperationOutputFor<'cart.current.read'>;
    const item = match === null ? undefined : cart.items[Number(match[1])];
    if (item === undefined) throw new Error('MINIAPP_CART_ITEM_INVALID');
    await client.cart.itemsPut(
      { path: { listingid: item.listing }, body: { quantity: requiredInteger(input, 'quantity', 0, 999), lineVersion: item.version, selected: item.selected } },
      context
    );
    return { message: '购物车已更新。' };
  },
});
