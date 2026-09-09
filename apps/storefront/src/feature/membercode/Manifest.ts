import { defineManifest } from '../../shared/manifest/StorefrontManifest';

export const MemberCodeManifest = defineManifest({
  feature: 'membercode',
  routes: [{ routeid: 'storemembercode', protected: true, load: () => import('./route/MemberCodeRoute') }],
});
