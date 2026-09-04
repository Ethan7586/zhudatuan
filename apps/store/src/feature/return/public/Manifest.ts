import { defineStoreFeature } from '../../../shared/FeatureManifest';

export const returnManifest = defineStoreFeature('return', [{ routeid: 'storereturnwork', title: '退货检验', breadcrumbs: ['门店工作台', '退货检验'], load: () => import('../route/ReturnRoute') }]);
