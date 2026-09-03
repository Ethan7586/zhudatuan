import { defineManifest } from '../../shared/manifest/StorefrontManifest';
export const AccountManifest = defineManifest({ feature: 'account', routes: [{ routeid: 'storeprofile', protected: true, load: () => import('./route/AccountRoute') }] });
