import { OP_IDENTITY_INVITATIONS_RESOLVE } from '@shop/contract/ids';
import { defineManifest } from '../../shared/manifest/AuthManifest';
export const InvitationManifest = defineManifest({
  routeid: 'authinvitation',
  operation: OP_IDENTITY_INVITATIONS_RESOLVE,
  scope: 'public',
  title: '使用邀请码注册',
  breadcrumbs: ['邀请码注册'],
  load: () => import('./route/InvitationRoute'),
});
