import { defineManifest } from '../../shared/manifest/StorefrontManifest';
export const BenefitManifest = defineManifest({ feature: 'benefit', routes: [{ routeid: 'storebenefits', protected: true, load: () => import('./route/BenefitRoute') }] });
