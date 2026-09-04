import { defineMiniappFeature } from '../../../shared/FeatureViewModel';

export const notificationViewModel = defineMiniappFeature({
  defaultRoute: 'miniappnotifications', routes: ['miniappnotifications'], title: '消息中心', description: '订单、福利和服务消息集中查看。',
  read: (client, context) => client.notification.notificationsRead({ query: { limit: 30 } }, context),
});
