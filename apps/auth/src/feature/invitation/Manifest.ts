import { OP_IDENTITY_INVITATIONS_RESOLVE } from '@shop/contract/ids';
import { defineManifest } from '../../shared/manifest/AuthManifest';
export const InvitationManifest = defineManifest({
  routeid: 'authinvitation',
  operation: OP_IDENTITY_INVITATIONS_RESOLVE,
  scope: 'public',
  title: '验证企业邀请',
  breadcrumbs: ['企业邀请'],
  load: () => import('./route/InvitationRoute'),
});
