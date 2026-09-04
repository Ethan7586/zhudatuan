import { defineSupplierFeature } from '../../../shared/FeatureManifest';

export const statementManifest = defineSupplierFeature('finance', [{ routeid: 'supplierstatements', title: '对账账单', breadcrumbs: ['供应链后台', '对账账单'], load: () => import('../route/StatementRoute') }]);
