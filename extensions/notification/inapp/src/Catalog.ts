import { miniappDeepLink, type DeepLink } from '@shop/contract';
import { OP_NOTIFICATION_NOTIFICATIONS_ACK } from '@shop/contract/ids';

export const InappCatalog = Object.freeze({
  id: 'inapp',
  name: '站内消息',
  business: '订单、福利、卡券、支付与服务进度通知',
  clients: Object.freeze(['storefront', 'miniapp'] as const),
  capabilities: Object.freeze(['Delivery', 'BatchDelivery', 'Acknowledgement', 'DeepLink'] as const),
  acknowledgement: Object.freeze({ operation: OP_NOTIFICATION_NOTIFICATIONS_ACK, title: '标记已读', idempotent: true }),
  deepLinks: Object.freeze([
    Object.freeze({ kind: 'product', route: 'productdetail', title: '查看商品' }),
    Object.freeze({ kind: 'order', route: 'orderdetail', title: '查看订单' }),
  ] as const),
  help: '消息写入后会出现在消费者消息中心；阅读状态按账号与设备水位同步，点击业务入口可安全跳转至商品或订单。',
} as const);

export function inappMiniappLink(target: DeepLink): string {
  if (!InappCatalog.deepLinks.some((entry) => entry.route === target.route)) throw new Error('INAPP_DEEP_LINK_UNSUPPORTED');
  return miniappDeepLink(target);
}
