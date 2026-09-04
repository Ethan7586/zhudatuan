import { defineMiniappManifest } from '../../shared/FeatureManifest';
import { homeViewModel } from './viewmodel/HomeViewModel';

export const HomeManifest = defineMiniappManifest('home', homeViewModel, [{ routeid: 'miniapphome', title: '今日福利', breadcrumbs: ['首页'], load: () => import('./page') }]);
