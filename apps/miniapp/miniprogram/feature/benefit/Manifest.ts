import { defineMiniappManifest } from '../../shared/FeatureManifest';
import { benefitViewModel } from './viewmodel/BenefitViewModel';

export const BenefitManifest = defineMiniappManifest('benefit', benefitViewModel, [{ routeid: 'miniappbenefits', title: '福利账户', breadcrumbs: ['我的', '福利账户'], load: () => import('./page') }]);
