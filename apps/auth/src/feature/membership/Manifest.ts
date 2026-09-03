import { defineManifest } from '../../shared/manifest/AuthManifest';
export const MembershipManifest = defineManifest({ routeid: 'authmembership', load: () => import('./route/MembershipRoute') });
