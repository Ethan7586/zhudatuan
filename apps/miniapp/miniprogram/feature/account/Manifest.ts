import { defineMiniappManifest } from '../../shared/FeatureManifest';
import { accountViewModel } from './viewmodel/AccountViewModel';

export const AccountManifest = defineMiniappManifest('account', accountViewModel, [
  { routeid: 'miniappprofile', title: '我的', breadcrumbs: ['我的'], load: () => import('./page') },
  { routeid: 'miniappsecurity', title: '安全中心', breadcrumbs: ['我的', '安全中心'], load: () => import('./page') },
]);
