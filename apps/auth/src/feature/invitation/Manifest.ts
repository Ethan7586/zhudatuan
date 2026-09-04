import { OP_IDENTITY_INVITATIONS_RESOLVE } from '@shop/contract/ids';
import { defineManifest } from '../../shared/manifest/AuthManifest';
export const InvitationManifest = defineManifest({ routeid: 'authinvitation', operation: OP_IDENTITY_INVITATIONS_RESOLVE, scope: 'public', title: '接受员工邀请', breadcrumbs: ['接受邀请'], load: () => import('./route/InvitationRoute') });
