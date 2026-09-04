import { defineMiniappManifest } from '../../shared/FeatureManifest';
import { voucherViewModel } from './viewmodel/VoucherViewModel';

export const VoucherManifest = defineMiniappManifest('voucher', voucherViewModel, [{ routeid: 'miniappvouchers', title: '我的卡券', breadcrumbs: ['我的', '我的卡券'], load: () => import('./page') }]);
