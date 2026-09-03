import { defineManifest } from '../../shared/manifest/StorefrontManifest';
export const CatalogManifest = defineManifest({ feature: 'catalog', routes: [{ routeid: 'storecatalog', protected: false, load: () => import('./route/CatalogRoute') }] });
