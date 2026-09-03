import { defineManifest } from '../../shared/manifest/StorefrontManifest';
export const SecurityManifest = defineManifest({ feature: 'security', routes: [{ routeid: 'storesecurity', protected: true, load: () => import('./route/SecurityRoute') }] });
