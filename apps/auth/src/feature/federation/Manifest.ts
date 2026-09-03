import { defineManifest } from '../../shared/manifest/AuthManifest';
export const FederationManifest = defineManifest({ routeid: 'authcallback', load: () => import('./route/CallbackRoute') });
