import { bindAftersalesApply, bindAftersalesRead } from '@shop/sdk/order';
import { connectMiniappClient, defineMiniappFeature } from '../../../shared/FeatureViewModel';
import type { OperationOutputFor } from '@shop/contract';
import { ORDER_AFTERSALE_REASONS } from '@shop/contract/vocabulary';
import { actionField, requiredInteger, requiredText } from '@shop/presentation/actions';
import { displayItem, displayPage, money } from '../../../shared/Display';

const REASON_LABEL: Readonly<Record<(typeof ORDER_AFTERSALE_REASONS)[number], string>> = Object.freeze({ quality: '质量问题', damaged: '到货破损', wrongitem: '商品错发', notneeded: '不再需要', service: '服务问题' });

export const aftersaleViewModel = defineMiniappFeature({
  defaultRoute: 'miniappaftersale', routes: ['miniappaftersale'], title: '售后服务', description: '提交前先核对订单与当前可申请范围。',
  connect: (executor) => connectMiniappClient({ order: { aftersalesApply: bindAftersalesApply(executor), aftersalesRead: bindAftersalesRead(executor) } }),
  read: (client, context, route) => {
    if (route.id !== 'miniappaftersale') throw new Error('MINIAPP_AFTERSALE_ROUTE_INVALID');
    return client.order.aftersalesRead({ query: { order: route.parameters.orderId, limit: 30 } }, context);
  },
  project: (value) => {
    const source = value as OperationOutputFor<'order.aftersales.read'>;
    return displayPage(source.items.map((item) => displayItem(item.id, `售后申请 · ${item.orderNumber}`, `${money(item.expectedRefundMinor, item.currency)} · ${REASON_LABEL[item.reasonCode as keyof typeof REASON_LABEL] ?? '其他原因'}`, item.state, item.updatedAt)));
  },
  actions: (value) => {
    const lines = (value as OperationOutputFor<'order.aftersales.read'>).availableLines.filter(({ available, maximumQuantity }) => available && maximumQuantity > 0);
    if (lines.length === 0) return [];
    return [Object.freeze({
      id: 'apply', label: '提交售后申请', description: '请选择可申请商品、数量和原因；提交后可在本页跟踪审核与退款。', tone: 'primary' as const,
      confirmation: '确认提交售后申请？提交后将进入审核流程。',
      fields: [
        actionField('line', '售后商品', { kind: 'choice', choices: lines.map((line) => ({ value: line.lineId, label: `${line.title}（最多 ${line.maximumQuantity} 件）` })) }),
        actionField('quantity', '申请数量', { kind: 'number', placeholder: '1', maximumLength: 3 }),
        actionField('reason', '售后原因', { kind: 'choice', choices: ORDER_AFTERSALE_REASONS.map((reason) => ({ value: reason, label: REASON_LABEL[reason] })) }),
        actionField('description', '问题说明', { maximumLength: 1000 }),
      ],
    })];
  },
  execute: async (client, context, route, value, action, input) => {
    if (route.id !== 'miniappaftersale' || action.id !== 'apply') throw new Error('MINIAPP_AFTERSALE_ACTION_INVALID');
    const source = value as OperationOutputFor<'order.aftersales.read'>;
    const lineId = requiredText(input, 'line');
    const line = source.availableLines.find((candidate) => candidate.lineId === lineId && candidate.available);
    if (line === undefined) throw new Error('MINIAPP_AFTERSALE_LINE_INVALID');
    const reason = requiredText(input, 'reason') as (typeof ORDER_AFTERSALE_REASONS)[number];
    if (!ORDER_AFTERSALE_REASONS.includes(reason)) throw new Error('MINIAPP_AFTERSALE_REASON_INVALID');
    await client.order.aftersalesApply({ path: { orderid: route.parameters.orderId }, body: {
      lines: [{ lineId, quantity: requiredInteger(input, 'quantity', 1, line.maximumQuantity) }],
      reason,
      description: requiredText(input, 'description', 1000),
      attachments: [],
    } }, context);
    return { message: '售后申请已提交，可在本页跟踪进度。' };
  },
});
