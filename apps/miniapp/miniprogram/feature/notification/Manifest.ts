import { defineMiniappManifest } from '../../shared/FeatureManifest';
import { notificationViewModel } from './viewmodel/NotificationViewModel';

export const NotificationManifest = defineMiniappManifest('notification', notificationViewModel, [{ routeid: 'miniappnotifications', title: '消息中心', breadcrumbs: ['我的', '消息中心'], load: () => import('./page') }]);
