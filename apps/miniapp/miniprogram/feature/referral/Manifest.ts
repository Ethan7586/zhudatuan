import { defineMiniappManifest } from '../../shared/FeatureManifest';
import { referralViewModel } from './viewmodel/ReferralViewModel';

export const ReferralManifest = defineMiniappManifest('referral', referralViewModel, [{ routeid: 'miniappreferral', title: '推荐收益', breadcrumbs: ['我的', '推荐收益'], load: () => import('./page') }]);
