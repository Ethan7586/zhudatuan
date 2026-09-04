import { defineStoreFeature } from '../../../shared/FeatureManifest';

export const accountManifest = defineStoreFeature('account', [{ routeid: 'storeaccountwork', title: '员工账户', breadcrumbs: ['门店工作台', '员工账户'], load: () => import('../route/AccountRoute') }]);
