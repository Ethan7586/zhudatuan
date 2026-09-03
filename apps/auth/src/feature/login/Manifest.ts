import { defineManifest } from '../../shared/manifest/AuthManifest';
export const LoginManifest = defineManifest({ routeid: 'authlogin', load: () => import('./route/LoginRoute') });
