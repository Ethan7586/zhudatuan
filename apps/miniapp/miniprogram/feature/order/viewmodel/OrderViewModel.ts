import { bindDetailRead, bindOrdersCancel, bindOrdersRead, bindRemindersCreate, bindOrdersReceive } from '@shop/sdk/order';
import { bindTrackingRead } from '@shop/sdk/fulfillment';
import { connectMiniappClient, defineMiniappFeature } from '../../../shared/FeatureViewModel';
import type { OperationOutputFor } from '@shop/contract';
import { actionField, requiredText } from '@shop/presentation/actions';
import { miniappPagePath } from '../../../generated/PageBinding';
import { displayItem, displayPage, money } from '../../../shared/Display';

export const orderViewModel = defineMiniappFeature({
  defaultRoute: 'miniapporders', routes: ['miniapporders', 'miniapporder'], title: '我的订单', description: '查看订单状态、履约进度与售后入口。',
  connect: (executor) => connectMiniappClient({ order: {
    detailRead: bindDetailRead(executor), ordersCancel: bindOrdersCancel(executor), ordersRead: bindOrdersRead(executor),
    remindersCreate: bindRemindersCreate(executor), ordersReceive: bindOrdersReceive(executor),
  }, fulfillment: { trackingRead: bindTrackingRead(executor) } }),
  read: async (client, context, route) => {
    if (route.id !== 'miniapporder') return client.order.ordersRead({ query: { limit: 30 } }, context);
    const [detail, tracking] = await Promise.all([
      client.order.detailRead({ path: { orderid: route.parameters.orderId } }, context),
      client.fulfillment.trackingRead({ query: { order: route.parameters.orderId } }, context),
    ]);
    return Object.freeze({ detail, tracking });
  },
  project: (value, route) => {
    if (route.id === 'miniapporders') {
      const source = value as OperationOutputFor<'order.orders.read'>;
      return displayPage(source.items.map((item) => displayItem(item.id, `订单 ${item.order_number}`, `${money(item.total_minor, item.currency)} · ${item.lines.length} 类商品`, item.lifecycle_state, item.updated_at)));
    }
    const source = detailSnapshot(value);
    const summary = source.detail.summary;
    const lines = source.detail.products.state === 'ready' ? source.detail.products.data : [];
    const tracking = source.tracking.items.flatMap((item) => item.shipments.flatMap((shipment) => shipment.packages.flatMap((parcel) => parcel.events)));
    return displayPage(
      [displayItem(summary.id, `订单 ${summary.orderNumber}`, `${money(summary.totalMinor, summary.currency)} · 支付与履约状态以服务端为准`, summary.lifecycleState, summary.updatedAt)],
      lines.map((line) => displayItem(line.id, line.title, `${line.quantity} 件 · ${money(line.payableMinor, summary.currency)}`, summary.fulfillmentState)),
      tracking.map((event) => displayItem(event.id, event.description, event.location ?? '物流进度已更新', event.state, event.occurredAt))
    );
  },
  actions: (value, route) => {
    if (route.id !== 'miniapporder') return [];
    const detail = detailSnapshot(value).detail;
    const order = detail.summary;
    const payment = detail.payment.state === 'ready' ? detail.payment.data.paymentId : null;
    const actions = [];
    if (['created', 'awaitingpayment'].includes(order.lifecycleState) && ['unpaid', 'authorizing', 'failed'].includes(order.paymentState)) actions.push(Object.freeze({
      id: 'cancel', label: '取消订单', description: '仅可取消尚未支付、尚未履约的订单，取消后不能恢复。', tone: 'danger' as const, expectedVersion: order.version,
      confirmation: '确认取消本订单？取消后不能恢复。', fields: [actionField('reason', '取消原因', { placeholder: '例如：收货信息有误，需要重新下单', maximumLength: 1000 })],
    }));
    if (['paid', 'fulfilling'].includes(order.lifecycleState)) actions.push(Object.freeze({ id: 'remind', label: '提醒发货', description: '向履约方提交一次发货提醒。', tone: 'secondary' as const, fields: [] }));
    if (['shipped'].includes(order.lifecycleState) || order.fulfillmentState === 'delivered') actions.push(Object.freeze({ id: 'receive', label: '确认收货', description: '请收到并检查商品后再确认。', tone: 'primary' as const, expectedVersion: order.version, confirmation: '确认已经收到并检查商品？', fields: [] }));
    if (['shipped', 'received', 'completed'].includes(order.lifecycleState)) actions.push(Object.freeze({ id: 'aftersale', label: '申请或查看售后', description: '进入售后页核对可申请商品和预计退款。', tone: 'secondary' as const, fields: [] }));
    if (payment !== null && ['unpaid', 'authorizing', 'failed'].includes(order.paymentState)) actions.push(Object.freeze({ id: 'payment', label: '继续支付或核验', description: '支付结果始终以服务端核验为准。', tone: 'primary' as const, fields: [] }));
    actions.push(Object.freeze({ id: 'support', label: '联系订单客服', description: '创建可持续跟踪的订单服务单。', tone: 'secondary' as const, fields: [] }));
    return actions;
  },
  execute: async (client, context, route, value, action, input) => {
    if (route.id !== 'miniapporder') throw new Error('MINIAPP_ORDER_ACTION_ROUTE_INVALID');
    const detail = detailSnapshot(value).detail;
    const order = detail.summary;
    const payment = detail.payment.state === 'ready' ? detail.payment.data.paymentId : null;
    if (action.id === 'cancel') await client.order.ordersCancel({ path: { orderid: order.id }, body: { expectedVersion: order.version, reason: requiredText(input, 'reason', 1000) } }, context);
    else if (action.id === 'remind') await client.order.remindersCreate({ path: { orderid: order.id }, body: {} }, context);
    else if (action.id === 'receive') await client.order.ordersReceive({ path: { orderid: order.id }, body: { expectedVersion: order.version } }, context);
    else if (action.id === 'aftersale') return { message: '正在打开售后服务。', destination: miniappPagePath('miniappaftersale', { orderId: order.id }) };
    else if (action.id === 'payment' && payment !== null) return { message: '正在打开支付结果。', destination: miniappPagePath('miniapppayment', { paymentId: payment }) };
    else if (action.id === 'support') return { message: '正在打开客服。', destination: miniappPagePath('miniappsupport') };
    else throw new Error('MINIAPP_ORDER_ACTION_INVALID');
    return { message: action.id === 'cancel' ? '订单已取消。' : action.id === 'receive' ? '已确认收货。' : '发货提醒已提交。' };
  },
  destination: (value, route, record) => {
    if (route.id !== 'miniapporders') return undefined;
    const item = (value as OperationOutputFor<'order.orders.read'>).items.find((candidate) => candidate.id === record || candidate.order_number === record);
    return item === undefined ? undefined : miniappPagePath('miniapporder', { orderId: item.id });
  },
});

interface OrderDetailSnapshot {
  readonly detail: OperationOutputFor<'order.detail.read'>;
  readonly tracking: OperationOutputFor<'fulfillment.tracking.read'>;
}

function detailSnapshot(value: unknown): OrderDetailSnapshot {
  return value as OrderDetailSnapshot;
}
