import { defineManifest } from '../../shared/manifest/StorefrontManifest';
export const HomeManifest = defineManifest({ feature: 'home', routes: [{ routeid: 'storehome', protected: false, load: () => import('./route/HomeRoute') }] });
