import { defineManifest } from '../../shared/manifest/StorefrontManifest';
export const SupportManifest = defineManifest({
  feature: 'support',
  routes: [
    { routeid: 'storesupport', protected: true, load: () => import('./route/SupportRoute') },
    { routeid: 'storesupportcase', protected: true, load: () => import('./route/ConversationRoute') },
  ],
});
