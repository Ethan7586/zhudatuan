import { OP_IDENTITY_BOOTSTRAP_READ } from '@shop/contract/ids';
import { defineManifest } from '../../shared/manifest/AuthManifest';
export const LoginManifest = defineManifest({ routeid: 'authlogin', operation: OP_IDENTITY_BOOTSTRAP_READ, scope: 'public', title: '登录福利商城', breadcrumbs: ['登录'], load: () => import('./route/LoginRoute') });
