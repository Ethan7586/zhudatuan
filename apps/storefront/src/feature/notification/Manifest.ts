import { defineManifest } from '../../shared/manifest/StorefrontManifest';
export const NotificationManifest = defineManifest({ feature: 'notification', routes: [{ routeid: 'storenotifications', protected: true, load: () => import('./route/NotificationRoute') }] });
