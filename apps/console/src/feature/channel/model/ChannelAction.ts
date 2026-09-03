import type { ChannelConnection, ChannelOperation, ChannelSync } from './Channel';

export type ChannelAction =
  | Readonly<{ kind: 'create' }>
  | Readonly<{ kind: 'update'; connection: ChannelConnection }>
  | Readonly<{ kind: 'test'; connection: ChannelConnection }>
  | Readonly<{ kind: 'enable'; connection: ChannelConnection }>
  | Readonly<{ kind: 'disable'; connection: ChannelConnection }>
  | Readonly<{ kind: 'startsync'; connection?: ChannelConnection }>
  | Readonly<{ kind: 'cancelsync'; sync: ChannelSync }>
  | Readonly<{ kind: 'replay'; operation: ChannelOperation }>;
