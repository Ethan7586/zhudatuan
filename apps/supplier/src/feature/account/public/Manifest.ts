import { defineSupplierFeature } from '../../../shared/FeatureManifest';

export const accountManifest = defineSupplierFeature('account', [{ routeid: 'supplieraccount', title: '供应商账户', breadcrumbs: ['供应链后台', '供应商账户'], load: () => import('../route/AccountRoute') }]);
