import { defineSupplierFeature } from '../../../shared/FeatureManifest';

export const supportManifest = defineSupplierFeature('support', [{ routeid: 'suppliersupport', title: '客服协同', breadcrumbs: ['供应链后台', '客服协同'], load: () => import('../route/SupportRoute') }]);
