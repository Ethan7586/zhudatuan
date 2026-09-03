import { defineManifest } from '../../shared/manifest/AuthManifest';
export const LinkManifest = defineManifest({ routeid: 'authlink', load: () => import('./route/LinkRoute') });
