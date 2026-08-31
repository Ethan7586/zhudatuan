import { defineComponent } from '../../shared/manifest/ComponentManifest';

export const ChannelManifest = defineComponent({
  component: 'channel',
  navigationids: ['platformchannel', 'groupchannel', 'mallchannel'],
  routes: [{ route: 'channels' }],
  load: () => import('./ChannelRoute'),
});
