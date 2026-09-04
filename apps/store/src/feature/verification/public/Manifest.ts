import { defineStoreFeature } from '../../../shared/FeatureManifest';

export const verificationManifest = defineStoreFeature('verification', [{ routeid: 'storeverification', title: '扫码核销', breadcrumbs: ['门店工作台', '扫码核销'], load: () => import('../route/VerificationRoute') }]);
