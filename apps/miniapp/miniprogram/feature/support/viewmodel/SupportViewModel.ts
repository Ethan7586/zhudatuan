import { bindCasesCreate, bindCasesRead, bindMessagesRead, bindMessagesSend } from '@shop/sdk/support';
import { connectMiniappClient, defineMiniappFeature } from '../../../shared/FeatureViewModel';
import type { OperationOutputFor } from '@shop/contract';
import { SUPPORT_PRIORITIES } from '@shop/contract/vocabulary';
import { actionField, optionalText, requiredText } from '@shop/presentation/actions';
import { miniappPagePath } from '../../../generated/PageBinding';
import { randomToken } from '../../../platform/Random';
import { displayItem, displayPage } from '../../../shared/Display';

const PRIORITY_LABEL: Readonly<Record<(typeof SUPPORT_PRIORITIES)[number], string>> = Object.freeze({ low: '不紧急', normal: '普通', high: '紧急', urgent: '非常紧急' });

export const supportViewModel = defineMiniappFeature({
  defaultRoute: 'miniappsupport', routes: ['miniappsupport', 'miniappsupportcase'], title: '客服与帮助', description: '查询服务单，问题进度全程可追踪。',
  connect: (executor) => connectMiniappClient({ support: {
    casesCreate: bindCasesCreate(executor), casesRead: bindCasesRead(executor), messagesRead: bindMessagesRead(executor), messagesSend: bindMessagesSend(executor),
  } }),
  read: (client, context, route) => route.id === 'miniappsupportcase'
    ? client.support.messagesRead({ path: { caseid: route.parameters.caseId }, query: { limit: 50 } }, context)
    : client.support.casesRead({ query: { limit: 30 } }, context),
  project: (value, route) => {
    if (route.id === 'miniappsupport') {
      const source = value as OperationOutputFor<'support.cases.read'>;
      return displayPage(source.items.map((item) => displayItem(item.id, item.subject, `${PRIORITY_LABEL[item.priority]} · ${item.unread_count} 条未读消息`, item.state, item.updated_at)));
    }
    const source = value as OperationOutputFor<'support.messages.read'>;
    return displayPage(source.items.map((item) => displayItem(item.id, item.authorType === 'member' ? '我' : item.authorType === 'agent' ? '客服' : '系统消息', item.body || '附件消息', item.kind, item.createdAt)));
  },
  actions: (value, route) => route.id === 'miniappsupport'
    ? [Object.freeze({ id: 'create', label: '新建服务单', description: '提交后会生成可持续跟踪的服务单，客服回复会出现在消息中心。', tone: 'primary' as const, fields: [
        actionField('subject', '问题主题', { maximumLength: 200 }),
        actionField('message', '问题说明', { maximumLength: 2000 }),
        actionField('priority', '紧急程度', { kind: 'choice', choices: SUPPORT_PRIORITIES.map((priority) => ({ value: priority, label: PRIORITY_LABEL[priority] })) }),
        actionField('order', '关联订单号', { required: false, maximumLength: 255 }),
      ] })]
    : [Object.freeze({ id: 'send', label: '发送消息', description: '消息发送后会立即刷新会话；请勿填写密码或完整券密。', tone: 'primary' as const, expectedVersion: (value as OperationOutputFor<'support.messages.read'>).conversationVersion, fields: [actionField('message', '回复内容', { maximumLength: 2000 })] })],
  execute: async (client, context, route, _value, action, input) => {
    if (route.id === 'miniappsupport' && action.id === 'create') {
      const priority = requiredText(input, 'priority') as (typeof SUPPORT_PRIORITIES)[number];
      if (!SUPPORT_PRIORITIES.includes(priority)) throw new Error('MINIAPP_SUPPORT_PRIORITY_INVALID');
      const order = optionalText(input, 'order', 255);
      const created = await client.support.casesCreate({ body: {
        subject: requiredText(input, 'subject', 200), message: requiredText(input, 'message', 2000), priority, channel: 'wechat',
        ...(order ? { order } : {}),
      } }, context);
      return { message: '服务单已创建。', destination: miniappPagePath('miniappsupportcase', { caseId: created.id }) };
    }
    if (route.id === 'miniappsupportcase' && action.id === 'send') {
      await client.support.messagesSend({ path: { caseid: route.parameters.caseId }, body: { message: requiredText(input, 'message', 2000), clientMessageId: await randomToken(32) } }, context);
      return { message: '消息已发送。' };
    }
    throw new Error('MINIAPP_SUPPORT_ACTION_INVALID');
  },
  destination: (value, route, record) => {
    if (route.id !== 'miniappsupport') return undefined;
    const item = (value as OperationOutputFor<'support.cases.read'>).items.find((candidate) => candidate.id === record || candidate.conversation_id === record);
    return item === undefined ? undefined : miniappPagePath('miniappsupportcase', { caseId: item.id });
  },
});
