import { defineSupplierFeature } from '../../../shared/FeatureManifest';

export const supportManifest = defineSupplierFeature('support', [
  { routeid: 'suppliersupport', title: '客服协同', breadcrumbs: ['供应链后台', '客服协同'], load: () => import('../route/SupportRoute') },
  { routeid: 'suppliercase', title: '客服会话', breadcrumbs: ['客服协同', '客服会话'], load: () => import('../route/SupportRoute') },
]);
