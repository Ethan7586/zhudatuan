import { actionField, requiredText } from '@shop/presentation/actions';
import { operatorCollection, operatorItems, operatorNumber, operatorRecord, operatorRow, operatorText, selectedOperatorRecord, supportCaseStatus } from '@shop/presentation/operator';
import { resolveRoutePath } from '../../../generated/RouteBinding';
import { supplierMessageId } from '../../../shared/Command';
import { defineSupplierViewModel } from '../../../shared/FeatureViewModel';

export const supportViewModel = defineSupplierViewModel({
  routes: ['suppliersupport', 'suppliercase'],
  title: '客服协同',
  description: '查看供应商相关服务单，在独立会话中回复顾客或发送仅内部可见的协同消息。',
  read: (client, context, route) =>
    route.id === 'suppliercase' ? client.support.messagesRead({ path: { caseid: route.parameters.caseId }, query: { limit: 50 } }, context) : client.support.casesRead({ query: { limit: 50, ownership: 'all' } }, context),
  project: (value, route) => (route.id === 'suppliercase' ? messageProjection(value) : caseProjection(value)),
  actions: (value, route, selectedKey) =>
    route.id === 'suppliercase'
      ? conversationActions(value)
      : selectedOperatorRecord(value, selectedKey)
        ? Object.freeze([Object.freeze({ id: 'open', label: '打开会话', description: '查看订单上下文并参与协同。', tone: 'primary', requiresSelection: true, fields: Object.freeze([]) })])
        : Object.freeze([]),
  execute: async (client, context, route, value, selectedKey, action, input) => {
    if (route.id === 'suppliersupport') {
      const item = selectedOperatorRecord(value, selectedKey);
      if (action.id !== 'open' || !item) throw new Error('请选择一条客服工单。');
      return { message: '已打开客服会话。', destination: resolveRoutePath('suppliercase', { scopeKind: route.parameters.scopeKind, scopeId: route.parameters.scopeId, caseId: operatorText(item, 'id') }), refresh: false };
    }
    if (route.id !== 'suppliercase') throw new Error('客服路由无效。');
    if (action.id === 'send') {
      const visibility = input.visibility === 'external' ? 'external' : 'internal';
      await client.support.messagesSend(
        {
          path: { caseid: route.parameters.caseId },
          body: {
            message: requiredText(input, 'message', 4000),
            clientMessageId: supplierMessageId(),
            visibility,
          },
        },
        context
      );
      return { message: visibility === 'external' ? '回复已发送给顾客。' : '内部协同消息已发送。' };
    }
    const state = conversationState(value);
    if (action.id === 'read' && state.conversation && state.latest > state.lastRead) {
      await client.support.readstatesManage({ path: { conversationid: state.conversation }, body: { lastSequence: state.latest } }, context);
      return { message: '会话已标记为已读。' };
    }
    throw new Error('会话状态已变化，请刷新后重试。');
  },
});

function conversationActions(value: unknown) {
  const state = conversationState(value);
  const send = Object.freeze({
    id: 'send',
    label: '发送消息',
    description: '回复顾客，或发送仅供应商和平台可见的内部消息。',
    tone: 'primary' as const,
    expectedVersion: state.version,
    fields: Object.freeze([
      actionField('visibility', '消息类型', {
        kind: 'choice',
        value: 'internal',
        choices: Object.freeze([
          { value: 'internal', label: '内部协同' },
          { value: 'external', label: '回复顾客' },
        ]),
      }),
      actionField('message', '消息内容', { kind: 'textarea', maximumLength: 4000 }),
    ]),
  });
  const read = state.conversation && state.latest > state.lastRead ? [Object.freeze({ id: 'read', label: '标记已读', description: '将当前会话标记到最新消息。', tone: 'secondary' as const, fields: Object.freeze([]) })] : [];
  return Object.freeze([send, ...read]);
}

function caseProjection(value: unknown) {
  return operatorCollection(
    value,
    operatorItems(value).map((item) =>
      operatorRow({
        key: operatorText(item, 'id'),
        title: operatorText(item, 'subject'),
        detail: `${priorityLabel(operatorText(item, 'priority'))} · 未读 ${operatorText(item, 'unread_count')} · ${operatorText(item, 'skill')}`,
        statusLabel: supportCaseStatus(operatorText(item, 'state'), operatorText(item, 'sla_risk')),
        timestamp: operatorText(item, 'updated_at'),
      })
    )
  );
}

function messageProjection(value: unknown) {
  return operatorCollection(
    value,
    operatorItems(value).map((item) =>
      operatorRow({
        key: operatorText(item, 'id'),
        title: operatorText(item, 'authorType') === 'member' ? '顾客' : operatorText(item, 'visibility') === 'internal' ? '内部协同' : '客服回复',
        detail: operatorText(item, 'body') || '附件消息',
        statusLabel: operatorText(item, 'visibility') === 'internal' ? '仅内部可见' : '顾客可见',
        timestamp: operatorText(item, 'createdAt'),
      })
    )
  );
}

function conversationState(value: unknown) {
  const root = operatorRecord(value);
  const first = operatorItems(value)[0];
  return {
    conversation: first ? operatorText(first, 'conversationId') : '',
    latest: operatorNumber(root ?? {}, 'latestSequence') ?? 0,
    lastRead: operatorNumber(root ?? {}, 'lastReadSequence') ?? 0,
    version: operatorNumber(root ?? {}, 'conversationVersion') ?? 0,
  };
}

function priorityLabel(value: string): string {
  return value === 'urgent' ? '非常紧急' : value === 'high' ? '高优先级' : value === 'low' ? '低优先级' : '普通优先级';
}
