import { defineStoreFeature } from '../../../shared/FeatureManifest';

export const voucherManifest = defineStoreFeature('voucher', [{ routeid: 'storevoucherswork', title: '核销记录', breadcrumbs: ['门店工作台', '核销记录'], load: () => import('../route/VoucherRoute') }]);
