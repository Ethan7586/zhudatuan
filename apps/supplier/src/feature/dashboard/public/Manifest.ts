import { defineSupplierFeature } from '../../../shared/FeatureManifest';

export const dashboardManifest = defineSupplierFeature('task', [{ routeid: 'suppliertasks', title: '待办任务', breadcrumbs: ['供应链后台', '待办任务'], load: () => import('../route/DashboardRoute') }]);
