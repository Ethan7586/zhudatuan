import { operatorCollection, operatorItems, operatorRow, operatorText } from '@shop/presentation/operator';
import { defineSupplierViewModel } from '../../../shared/FeatureViewModel';

export const dashboardViewModel = defineSupplierViewModel({
  routes: ['suppliertasks'],
  title: '今日待办',
  description: '汇总待确认订单、待发货、退货质检、客服时限和连接异常，按风险优先处理。',
  read: async (client, context) => {
    const [work, returns, cases, connections] = await Promise.all([
      client.fulfillment.workitemsRead({ query: { limit: 30, state: ['submitted', 'accepted', 'processing', 'ready', 'needsaction'] } }, context),
      client.fulfillment.returnsRead({ query: { limit: 20, state: ['authorized', 'intransit', 'received'] } }, context),
      client.support.casesRead({ query: { limit: 20, ownership: 'all', states: ['open', 'assigned', 'waiting'], unread: true } }, context),
      client.channel.connectionsRead({ query: { limit: 20 } }, context),
    ]);
    const items = [
      ...work.items.map((item) => ({ ...item, dashboard_kind: item.state === 'ready' ? 'shipment' : 'order', id: `task:${item.id}` })),
      ...returns.items.map((item) => ({ ...item, dashboard_kind: 'return', id: `task:${item.id}` })),
      ...cases.items.filter((item) => item.sla_risk !== 'normal' || item.priority === 'high' || item.priority === 'urgent').map((item) => ({ ...item, dashboard_kind: 'support', id: `task:${item.id}` })),
      ...connections.items.filter((item) => item.health_state !== null && item.health_state !== 'healthy').map((item) => ({ ...item, dashboard_kind: 'connection', id: `task:${item.id}` })),
    ];
    return Object.freeze({ items: Object.freeze(items), count: items.length });
  },
  project: (value) =>
    operatorCollection(
      value,
      operatorItems(value).map((item) =>
        operatorRow({
          key: operatorText(item, 'id'),
          title: taskTitle(item),
          detail: taskDetail(item),
          statusLabel: taskStatus(item),
          timestamp: operatorText(item, 'updated_at') || operatorText(item, 'checked_at'),
        })
      )
    ),
});

function taskTitle(item: Parameters<typeof operatorText>[0]): string {
  const kind = operatorText(item, 'dashboard_kind');
  if (kind === 'return') return `退货 ${operatorText(item, 'order_number')}`;
  if (kind === 'support') return `客服工单 · ${operatorText(item, 'subject')}`;
  if (kind === 'connection') return `接口连接 · ${operatorText(item, 'provider')}`;
  return `${kind === 'shipment' ? '待发货' : '待处理订单'} ${operatorText(item, 'order_number') || operatorText(item, 'order_id')}`;
}

function taskDetail(item: Parameters<typeof operatorText>[0]): string {
  const kind = operatorText(item, 'dashboard_kind');
  if (kind === 'support') return `未读 ${operatorText(item, 'unread_count')} 条 · ${priority(operatorText(item, 'priority'))}`;
  if (kind === 'connection') return operatorText(item, 'health_reason') || '连接健康检查未通过';
  if (kind === 'return') return '请确认收货或完成质检';
  return `${operatorText(item, 'member_masked')} · ${Array.isArray(item.lines) ? item.lines.length : 0} 种商品`;
}

function taskStatus(item: Parameters<typeof operatorText>[0]): string {
  const kind = operatorText(item, 'dashboard_kind');
  if (kind === 'support') return operatorText(item, 'sla_risk') === 'overdue' ? '服务已逾期' : '需优先回复';
  if (kind === 'connection') return operatorText(item, 'health_state') === 'unhealthy' ? '连接不可用' : '连接性能下降';
  if (kind === 'return') return operatorText(item, 'state') === 'received' ? '待质检' : '待收货';
  if (operatorText(item, 'priority') === 'overdue') return '已逾期';
  return kind === 'shipment' ? '待发货' : '待确认或备货';
}

function priority(value: string): string {
  return value === 'urgent' ? '非常紧急' : value === 'high' ? '高优先级' : '普通优先级';
}
