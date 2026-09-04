import { OP_IDENTITY_FEDERATIONS_SELECTION_READ } from '@shop/contract/ids';
import { defineManifest } from '../../shared/manifest/AuthManifest';
export const MembershipManifest = defineManifest({
  routeid: 'authmembership',
  operation: OP_IDENTITY_FEDERATIONS_SELECTION_READ,
  scope: 'preauth',
  title: '选择成员身份',
  breadcrumbs: ['选择成员身份'],
  load: () => import('./route/MembershipRoute'),
});
