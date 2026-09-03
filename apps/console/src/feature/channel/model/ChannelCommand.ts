import type { ConnectionDraft, SyncDraft } from './Channel';

export type ChannelCommand = (
  | Readonly<{ kind: 'create'; draft: ConnectionDraft; proof: string }>
  | Readonly<{ kind: 'update'; connection: string; version: number; draft: ConnectionDraft; proof: string }>
  | Readonly<{ kind: 'test'; connection: string; version: number; proof: string }>
  | Readonly<{ kind: 'enable'; connection: string; version: number; proof: string }>
  | Readonly<{ kind: 'disable'; connection: string; version: number; proof: string }>
  | Readonly<{ kind: 'startsync'; draft: SyncDraft }>
  | Readonly<{ kind: 'cancelsync'; sync: string; version: number }>
  | Readonly<{ kind: 'replay'; operation: string; proof: string }>
) & Readonly<{ identity: string }>;
