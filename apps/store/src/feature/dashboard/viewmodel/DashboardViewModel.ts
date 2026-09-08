import { resolveRoutePath } from '../../../generated/RouteBinding';
import { defineStoreViewModel } from '../../../shared/FeatureViewModel';
import { operatorCollection as displayCollection, operatorItems as dataItems, operatorRow as displayRow, operatorText as recordText, selectedOperatorRecord as selectedRecord } from '@shop/presentation/operator';
import { chineseDomainLabel } from '@shop/presentation';

export const dashboardViewModel = defineStoreViewModel({
  routes: ['storetasks'],
  title: '今日任务',
  description: '聚合接单、履约、退货和客服风险，逾期与异常任务优先展示。',
  read: async (client, context) => {
    const [work, returns, support] = await Promise.all([
      client.fulfillment.workitemsRead({ query: { limit: 20, state: ['submitted', 'accepted', 'processing', 'ready', 'failed', 'needsaction'] } }, context),
      client.fulfillment.returnsRead({ query: { limit: 20, state: ['authorized', 'intransit', 'received'] } }, context),
      client.support.casesRead({ query: { limit: 20, ownership: 'all', states: ['open', 'assigned', 'waiting'], priorities: ['urgent', 'high'], unread: true } }, context),
    ]);
    const items = [
      ...dataItems(work).map((item) => ({ ...item, id: `order:${recordText(item, 'id')}`, taskKind: 'order', taskId: recordText(item, 'id') })),
      ...dataItems(returns).map((item) => ({ ...item, id: `return:${recordText(item, 'id')}`, taskKind: 'return', taskId: recordText(item, 'id') })),
      ...dataItems(support).map((item) => ({ ...item, id: `support:${recordText(item, 'id')}`, taskKind: 'support', taskId: recordText(item, 'id') })),
    ].sort((left, right) => urgency(right) - urgency(left));
    return Object.freeze({ items: Object.freeze(items.slice(0, 50)), count: items.length });
  },
  project: taskProjection,
  actions: (value, _route, selectedKey) =>
    selectedRecord(value, selectedKey)
      ? Object.freeze([Object.freeze({ id: 'open', label: '打开处理页', description: '进入对应业务页面继续处理。', tone: 'primary', requiresSelection: true, fields: Object.freeze([]) })])
      : Object.freeze([]),
  execute: async (_client, _context, route, value, selectedKey, action) => {
    const item = selectedRecord(value, selectedKey);
    if (action.id !== 'open' || !item || route.id !== 'storetasks') throw new Error('请选择一条今日任务。');
    const parameters = { scopeKind: route.parameters.scopeKind, scopeId: route.parameters.scopeId };
    const destination =
      recordText(item, 'taskKind') === 'return'
        ? resolveRoutePath('storereturnwork', parameters)
        : recordText(item, 'taskKind') === 'support'
          ? resolveRoutePath('storeworkcase', { ...parameters, caseId: recordText(item, 'taskId') })
          : resolveRoutePath('storeorderswork', parameters);
    return { message: '已打开对应处理页。', destination, refresh: false };
  },
});

function taskProjection(value: unknown) {
  return displayCollection(
    value,
    dataItems(value).map((item) => {
      const kind = recordText(item, 'taskKind');
      const title = kind === 'return' ? `退货 ${recordText(item, 'order_number')}` : kind === 'support' ? recordText(item, 'subject') : `订单 ${recordText(item, 'order_number')}`;
      const detail = kind === 'support' ? `客服 · ${chineseDomainLabel(recordText(item, 'priority'), '普通优先级')} · 未读 ${recordText(item, 'unread_count')}` : kind === 'return' ? '退货到店或检验待处理' : '接单、备货或交付待处理';
      return displayRow({
        key: recordText(item, 'id'),
        title,
        detail,
        statusLabel: taskStatus(kind === 'support' ? recordText(item, 'sla_risk') : recordText(item, 'priority') || recordText(item, 'state')),
        timestamp: recordText(item, 'updated_at'),
      });
    })
  );
}

function urgency(value: Readonly<Record<string, unknown>>): number {
  const state = recordText(value, 'sla_risk') || recordText(value, 'priority') || recordText(value, 'state');
  return ({ overdue: 5, risk: 4, urgent: 4, high: 3, needsaction: 3, failed: 3 } as Readonly<Record<string, number>>)[state] ?? 1;
}

function taskStatus(value: string): string {
  if (value === 'overdue') return '已逾期';
  if (value === 'risk') return '需优先处理';
  if (value === 'urgent') return '紧急';
  if (value === 'high') return '高优先级';
  if (value === 'needsaction') return '需人工处理';
  return value === 'failed' ? '处理失败' : '待处理';
}
