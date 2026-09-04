import { defineComponent } from '../../shared/manifest/ComponentManifest';

export const ControlManifest = defineComponent({
  component: 'control',
  navigationids: ['platformcontrol', 'distributioncontrol', 'groupcontrol', 'mallcontrol'],
  routes: [{ routeid: 'consolecontrol' }],
  load: () => import('./route/ControlRoute'),
});
