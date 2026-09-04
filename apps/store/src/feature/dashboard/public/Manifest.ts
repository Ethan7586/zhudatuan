import { defineStoreFeature } from '../../../shared/FeatureManifest';

export const dashboardManifest = defineStoreFeature('task', [{ routeid: 'storetasks', title: '今日任务', breadcrumbs: ['门店工作台', '今日任务'], load: () => import('../route/DashboardRoute') }]);
