import { defineManifest } from '../../shared/manifest/AuthManifest';
export const InvitationManifest = defineManifest({ routeid: 'authinvitation', load: () => import('./route/InvitationRoute') });
