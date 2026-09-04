import { defineMiniappManifest } from '../../shared/FeatureManifest';
import { catalogViewModel } from './viewmodel/CatalogViewModel';

export const CatalogManifest = defineMiniappManifest('catalog', catalogViewModel, [{ routeid: 'miniappcatalog', title: '选购福利', breadcrumbs: ['首页', '选购福利'], load: () => import('./page') }]);
