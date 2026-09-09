import { defineMiniappManifest } from '../../shared/FeatureManifest';
import { memberCodeViewModel } from './viewmodel/MemberCodeViewModel';

export const MemberCodeManifest = defineMiniappManifest('membercode', memberCodeViewModel, [
  { routeid: 'miniappmembercode', title: '会员码', breadcrumbs: ['会员码'], load: () => import('./page') },
]);
