import { defineMiniappFeature } from '../../../shared/FeatureViewModel';

export const supportViewModel = defineMiniappFeature({
  defaultRoute: 'miniappsupport', routes: ['miniappsupport', 'miniappsupportcase'], title: '客服与帮助', description: '查询服务单，问题进度全程可追踪。',
  read: (client, context, route) => route.id === 'miniappsupportcase'
    ? client.support.messagesRead({ path: { caseid: route.parameters.caseId }, query: { limit: 50 } }, context)
    : client.support.casesRead({ query: { limit: 30 } }, context),
});
