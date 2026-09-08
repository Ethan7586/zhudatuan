import { bindIntentsRead } from '@shop/sdk/payment';
import { connectMiniappClient, defineMiniappFeature } from '../../../shared/FeatureViewModel';
import type { OperationOutputFor } from '@shop/contract';
import { miniappPagePath } from '../../../generated/PageBinding';
import { chineseDomainLabel } from '@shop/presentation/chinese';
import { displayItem, displayPage } from '../../../shared/Display';

export const paymentViewModel = defineMiniappFeature({
  defaultRoute: 'miniapppayment', routes: ['miniapppayment'], title: '支付结果', description: '支付结果由服务端核验，未确认时不会显示成功。',
  connect: (executor) => connectMiniappClient({ payment: { intentsRead: bindIntentsRead(executor) } }),
  read: (client, context, route) => {
    if (route.id !== 'miniapppayment') throw new Error('MINIAPP_PAYMENT_ROUTE_INVALID');
    return client.payment.intentsRead({ path: { paymentid: route.parameters.paymentId } }, context);
  },
  project: (value) => {
    const intent = value as OperationOutputFor<'payment.intents.read'>;
    return displayPage([displayItem(intent.intentId, '订单支付', intent.state === 'captured' ? '服务端已确认支付成功。' : '支付结果仍在服务端核验中。', intent.state, intent.expiresAt)]);
  },
  actions: (value) => {
    const intent = value as OperationOutputFor<'payment.intents.read'>;
    if (intent.state === 'captured') return [Object.freeze({ id: 'order', label: '查看订单', description: '支付已由服务端确认，可进入订单查看履约进度。', tone: 'primary' as const, fields: [] })];
    if (intent.state === 'pending' && intent.action !== null) return [Object.freeze({ id: 'pay', label: '继续微信支付', description: '调起微信支付后，本页仍会向服务端核验最终结果。', tone: 'primary' as const, fields: [] })];
    return [Object.freeze({ id: 'verify', label: '重新核验支付结果', description: `当前为“${chineseDomainLabel(intent.state)}”，不会在服务端确认前显示支付成功。`, tone: 'secondary' as const, fields: [] })];
  },
  execute: async (_client, _context, _route, value, action) => {
    const intent = value as OperationOutputFor<'payment.intents.read'>;
    if (action.id === 'order') return { message: '正在打开订单。', destination: miniappPagePath('miniapporder', { orderId: intent.orderId }) };
    if (action.id === 'verify') return { message: '支付结果已重新核验。' };
    if (action.id !== 'pay' || intent.state !== 'pending' || intent.action === null) throw new Error('MINIAPP_PAYMENT_NOT_PAYABLE');
    return { message: '微信支付已返回，正在核验服务端结果。', payment: intent.action };
  },
});
