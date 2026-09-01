import type { ConsoleModuleManifest } from '../../entity/navigation/ConsoleModuleManifest';

export const channelsModule = {
  id: 'channels',
  status: 'enabled',
  navigation: { placement: 'main', group: 'commerce', order: 70, label: '渠道接入系统', icon: 'channel' },
  routes: [{
    id: 'channels.index',
    path: 'channels',
    kind: 'entry',
    lazy: () => import('./ChannelRoute'),
    operations: ['channel.connections.read', 'channel.syncruns.read', 'channel.operations.read'],
    presentation: { title: '渠道管理', summary: '连接、同步批次和外部操作回执' },
  }],
} as const satisfies ConsoleModuleManifest<'channels'>;
