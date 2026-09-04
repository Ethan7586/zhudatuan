import type { ChannelConnection, ChannelOperation, ChannelSync } from './Channel';

export interface ChannelPermissions {
  readonly create: boolean;
  readonly update: boolean;
  readonly test: boolean;
  readonly enable: boolean;
  readonly disable: boolean;
  readonly startSync: boolean;
  readonly cancelSync: boolean;
  readonly replay: boolean;
}
export function connectionActions(record: ChannelConnection, permissions: ChannelPermissions) {
  return Object.freeze({
    update: permissions.update && (record.state === 'draft' || record.state === 'disabled'),
    test: permissions.test && (record.state === 'draft' || record.state === 'degraded' || record.state === 'disabled'),
    enable: permissions.enable && (record.state === 'testing' || record.state === 'degraded'),
    disable: permissions.disable && record.state !== 'disabled',
    sync: permissions.startSync && record.state === 'enabled',
  });
}
export function canCancel(record: ChannelSync, permissions: ChannelPermissions): boolean {
  return permissions.cancelSync && (record.state === 'queued' || record.state === 'running');
}
export function canReplay(record: ChannelOperation, permissions: ChannelPermissions): boolean {
  return permissions.replay && (record.state === 'failed' || record.state === 'unknown');
}
