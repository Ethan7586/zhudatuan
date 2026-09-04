import { defineSupplierFeature } from '../../../shared/FeatureManifest';

export const reconciliationManifest = defineSupplierFeature('reconciliation', [{ routeid: 'supplierreconciliation', title: '对账处理', breadcrumbs: ['供应链后台', '对账处理'], load: () => import('../route/ReconciliationRoute') }]);
