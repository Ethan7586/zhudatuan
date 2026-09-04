import { describe, expect, it } from 'vitest';
import * as channelPublic from '..';
import { CHANNEL_CAPABILITIES, channelManifest } from '..';

describe('channel module manifest', () => {
  it('keeps the stable channel identity and lightweight public entry', () => {
    expect(channelManifest.id).toBe('channel');
    expect(channelManifest.publicEntry).toBe('./index.ts');
    expect(channelManifest.provides).toEqual([CHANNEL_CAPABILITIES.read, CHANNEL_CAPABILITIES.manage]);
    expect(channelPublic).not.toHaveProperty('ChannelModule');
    expect(channelPublic).not.toHaveProperty('channelExtensionSink');
    expect(channelPublic).not.toHaveProperty('createPrivateProviderInstallation');
  });

  it('declares channel dependencies, layers, and entrypoints', () => {
    expect(channelManifest.requires).toEqual(['extension', 'catalog', 'inventory', 'fulfillment', 'finance']);
    expect(channelManifest.layers).toEqual(['public', 'domain', 'application', 'adapters', 'interface', 'tests']);
    expect(channelManifest.entrypoints.http).toEqual(['channelRoutes', 'channelOperatorReadOperations']);
    expect(channelManifest.entrypoints.jobs).toEqual([
      'catalogsync',
      'pricesync',
      'inventorysync',
      'statementsync',
      'channelwebhook',
    ]);
  });

  it('declares the channel operation inventory', () => {
    expect(channelManifest.operations).toEqual([
      'channel.distributors.create',
      'channel.distributors.read',
      'channel.distributors.update',
      'channel.distributors.disable',
      'channel.bindings.manage',
      'channel.quotas.manage',
      'channel.connections.read',
      'channel.connections.create',
      'channel.connections.update',
      'channel.connections.test',
      'channel.connections.enable',
      'channel.connections.disable',
      'channel.webhooks.receive',
      'channel.syncruns.start',
      'channel.syncruns.read',
      'channel.syncruns.cancel',
      'channel.operations.read',
      'channel.operations.replay',
    ]);
  });

  it('declares channel event ownership', () => {
    expect(channelManifest.publishes).toEqual([
      'channel.sync.completed',
      'channel.webhook.applied',
      'channel.refund.changed',
    ]);
    expect(channelManifest.consumes).toEqual([]);
  });
});
