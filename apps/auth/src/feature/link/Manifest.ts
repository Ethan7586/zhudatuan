import { OP_IDENTITY_LINKS_READ } from '@shop/contract/ids';
import { defineManifest } from '../../shared/manifest/AuthManifest';
export const LinkManifest = defineManifest({ routeid: 'authlink', operation: OP_IDENTITY_LINKS_READ, scope: 'self', title: '绑定已有账户', breadcrumbs: ['绑定已有账户'], load: () => import('./route/LinkRoute') });
