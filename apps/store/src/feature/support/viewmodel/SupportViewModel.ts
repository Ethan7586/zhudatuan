import { actionField, requiredText } from '@shop/presentation/actions';
import { resolveRoutePath } from '../../../generated/RouteBinding';
import { clientMessageId } from '../../../shared/Command';
import { defineStoreViewModel } from '../../../shared/FeatureViewModel';
import {
  operatorCollection as displayCollection,
  operatorItems as dataItems,
  operatorNumber as recordNumber,
  operatorRecord as dataRecord,
  operatorRow as displayRow,
  operatorText as recordText,
  selectedOperatorRecord as selectedRecord,
  supportCaseStatus,
} from '@shop/presentation/operator';

export const supportViewModel = defineStoreViewModel({
  routes: ['storesupportwork', 'storeworkcase'],
  title: '客服协同',
  description: '查看门店相关工单，在独立会话中发送对客回复或内部协同消息。',
  read: (client, context, route) =>
    route.id === 'storeworkcase' ? client.support.messagesRead({ path: { caseid: route.parameters.caseId }, query: { limit: 50 } }, context) : client.support.casesRead({ query: { limit: 50, ownership: 'all' } }, context),
  project: (value, route) => (route.id === 'storeworkcase' ? messageProjection(value) : caseProjection(value)),
  actions: (value, route, selectedKey) =>
    route.id === 'storeworkcase'
      ? conversationActions(value)
      : selectedRecord(value, selectedKey)
        ? Object.freeze([Object.freeze({ id: 'open', label: '打开会话', description: '查看上下文并回复该工单。', tone: 'primary', requiresSelection: true, fields: Object.freeze([]) })])
        : Object.freeze([]),
  execute: async (client, context, route, value, selectedKey, action, input) => {
    if (route.id === 'storesupportwork') {
      const item = selectedRecord(value, selectedKey);
      if (action.id !== 'open' || !item) throw new Error('请选择一条客服工单。');
      return { message: '已打开客服会话。', destination: resolveRoutePath('storeworkcase', { scopeKind: route.parameters.scopeKind, scopeId: route.parameters.scopeId, caseId: recordText(item, 'id') }), refresh: false };
    }
    if (route.id !== 'storeworkcase') throw new Error('客服路由无效。');
    if (action.id === 'send') {
      const visibility = input.visibility === 'external' ? 'external' : 'internal';
      await client.support.messagesSend({ path: { caseid: route.parameters.caseId }, body: { message: requiredText(input, 'message', 4000), clientMessageId: clientMessageId(), visibility } }, context);
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
    description: '发送对客回复或仅门店可见的内部协同消息。',
    tone: 'primary',
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
  } as const);
  const read = state.conversation && state.latest > state.lastRead ? [Object.freeze({ id: 'read', label: '标记已读', description: '将当前会话标记到最新消息。', tone: 'secondary', fields: Object.freeze([]) } as const)] : [];
  return Object.freeze([send, ...read]);
}

function caseProjection(value: unknown) {
  return displayCollection(
    value,
    dataItems(value).map((item) =>
      displayRow({
        key: recordText(item, 'id'),
        title: recordText(item, 'subject'),
        detail: `${priorityLabel(recordText(item, 'priority'))} · 未读 ${recordText(item, 'unread_count')} · ${recordText(item, 'skill')}`,
        statusLabel: supportCaseStatus(recordText(item, 'state'), recordText(item, 'sla_risk')),
        timestamp: recordText(item, 'updated_at'),
      })
    )
  );
}

function messageProjection(value: unknown) {
  return displayCollection(
    value,
    dataItems(value).map((item) =>
      displayRow({
        key: recordText(item, 'id'),
        title: recordText(item, 'authorType') === 'member' ? '顾客' : recordText(item, 'visibility') === 'internal' ? '内部协同' : '客服回复',
        detail: recordText(item, 'body'),
        statusLabel: recordText(item, 'visibility') === 'internal' ? '仅内部可见' : '顾客可见',
        timestamp: recordText(item, 'createdAt'),
      })
    )
  );
}

function conversationState(value: unknown) {
  const root = dataRecord(value);
  const first = dataItems(value)[0];
  return {
    conversation: first ? recordText(first, 'conversationId') : '',
    latest: recordNumber(root ?? {}, 'latestSequence') ?? 0,
    lastRead: recordNumber(root ?? {}, 'lastReadSequence') ?? 0,
    version: recordNumber(root ?? {}, 'conversationVersion') ?? 0,
  };
}

function priorityLabel(value: string): string {
  if (value === 'urgent') return '紧急';
  if (value === 'high') return '高优先级';
  if (value === 'low') return '低优先级';
  return '普通优先级';
}
