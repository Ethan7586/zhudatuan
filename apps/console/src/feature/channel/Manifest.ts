import { defineComponent } from '../../shared/manifest/ComponentManifest';

export const ChannelManifest = defineComponent({
  component: 'channel',
  navigationids: ['platformchannel', 'groupchannel', 'mallchannel'],
  routes: [{ routeid: 'consolechannels' }],
  load: () => import('./route/ChannelRoute'),
});
