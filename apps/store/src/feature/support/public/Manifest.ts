import { defineStoreFeature } from '../../../shared/FeatureManifest';

export const supportManifest = defineStoreFeature('support', [{ routeid: 'storesupportwork', title: '客服协同', breadcrumbs: ['门店工作台', '客服协同'], load: () => import('../route/SupportRoute') }]);
