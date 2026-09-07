import { describe, expect, it } from 'vitest';
import {
  recoverLocalIdentitySearch,
  resolveConsumerIdentityEntry,
  resolveIdentityEntry,
} from './consumerIdentityEntry';
import { configuredIdentityNodeRegistry } from './identityNodeEnvironment';
import { parseIdentityNodeRegistry } from '@shop/sdk/identity-node';

const registry = configuredIdentityNodeRegistry();
const l0 = registry.nodes.find((node) => node.nodeId === 'l0')!;
const l1 = registry.nodes.find((node) => node.nodeId === 'l1')!;

describe('consumer identity entry', () => {
  it('routes a declared storefront application to the consumer adapter', () => {
    expect(resolveConsumerIdentityEntry('?target=storefront-hbbtzn&surface=web&application=zdt-l1-verify', l1)).toEqual({
      application: 'zdt-l1-verify',
      target: 'storefront-hbbtzn',
    });
    expect(resolveConsumerIdentityEntry('?target=storefront&application=zhudatuan-storefront', l0)).toEqual({
      application: 'zhudatuan-storefront',
      target: 'storefront',
    });
    expect(resolveConsumerIdentityEntry('?target=storefront&application=zdt-l1-verify', l1)).toBeNull();
    expect(resolveConsumerIdentityEntry('?target=storefront-hbbtzn&application=zhudatuan-storefront', l0)).toBeNull();
    expect(resolveConsumerIdentityEntry('?target=storefront&application=another-mall', l0)).toBeNull();
    expect(resolveConsumerIdentityEntry('?target=storefront&application=INVALID_APP', l0)).toBeNull();
    expect(resolveConsumerIdentityEntry('?client=console-hbbtzn&application=zdt-l1-verify', l1)).toBeNull();
  });
});

describe('node-bound identity entry', () => {
  it('accepts only the consumer application belonging to the current accounts host', () => {
    expect(resolveIdentityEntry(
      '?target=storefront&application=zhudatuan-storefront', 'accounts.zhudatuan.com',
    )).toMatchObject({ kind: 'consumer', target: 'storefront' });
    expect(resolveIdentityEntry(
      '?target=storefront-hbbtzn&application=zdt-l1-verify', 'accounts.hbbtzn.com',
    )).toMatchObject({ kind: 'consumer', target: 'storefront-hbbtzn' });
    expect(resolveIdentityEntry(
      '?target=storefront&application=zhudatuan-storefront', 'accounts.hbbtzn.com',
    )).toBeNull();
    expect(resolveIdentityEntry(
      '?target=storefront-hbbtzn&application=zdt-l1-verify', 'accounts.zhudatuan.com',
    )).toBeNull();
  });

  it('binds operator targets to the current accounts host', () => {
    expect(resolveIdentityEntry('', 'accounts.zhudatuan.com')).toMatchObject({ kind: 'operator', nodeId: 'l0', target: 'console' });
    expect(resolveIdentityEntry('', 'accounts.hbbtzn.com')).toMatchObject({ kind: 'operator', nodeId: 'l1', target: 'console-hbbtzn' });
    expect(resolveIdentityEntry('?target=console', 'accounts.hbbtzn.com')).toBeNull();
    expect(resolveIdentityEntry('?target=console-hbbtzn', 'accounts.zhudatuan.com')).toBeNull();
    expect(resolveIdentityEntry('?target=console&client=console-hbbtzn', 'accounts.zhudatuan.com')).toBeNull();
    expect(resolveIdentityEntry(
      '?target=console&client=console&admin_origin=https%3A%2F%2Fconsole.hbbtzn.com', 'accounts.zhudatuan.com',
    )).toBeNull();
    expect(resolveIdentityEntry(
      '?target=console-hbbtzn&client=console-hbbtzn&admin_origin=https%3A%2F%2Fconsole.zhudatuan.com', 'accounts.hbbtzn.com',
    )).toBeNull();
    expect(resolveIdentityEntry('', 'untrusted.example.com')).toBeNull();
  });

  it('keeps unsigned cross-node links inside the current node instead of showing a rejection page', () => {
    expect(recoverLocalIdentitySearch(
      '?target=storefront-hbbtzn&surface=web&application=zdt-l1-verify&v=old',
      'accounts.zhudatuan.com',
    )).toBe('?target=storefront&surface=web&application=zhudatuan-storefront&v=old');
    expect(recoverLocalIdentitySearch(
      '?target=storefront&surface=web&application=zhudatuan-storefront&v=old',
      'accounts.hbbtzn.com',
    )).toBe('?target=storefront-hbbtzn&surface=web&application=zdt-l1-verify&v=old');
    expect(recoverLocalIdentitySearch(
      '?target=console-hbbtzn&client=console-hbbtzn&admin_origin=https%3A%2F%2Fconsole.hbbtzn.com',
      'accounts.zhudatuan.com',
    )).toBe('?target=console&client=console&admin_origin=https%3A%2F%2Fconsole.zhudatuan.com');
    expect(recoverLocalIdentitySearch(
      '?target=console&client=console&admin_origin=https%3A%2F%2Fconsole.zhudatuan.com',
      'accounts.hbbtzn.com',
    )).toBe('?target=console-hbbtzn&client=console-hbbtzn&admin_origin=https%3A%2F%2Fconsole.hbbtzn.com');
    expect(recoverLocalIdentitySearch(
      '?target=console&client=console&admin_origin=https%3A%2F%2Fconsole.hbbtzn.com',
      'accounts.zhudatuan.com',
    )).toBe('?target=console&client=console&admin_origin=https%3A%2F%2Fconsole.zhudatuan.com');
    expect(recoverLocalIdentitySearch(
      '?target=console-hbbtzn&client=console-hbbtzn&admin_origin=https%3A%2F%2Fconsole.zhudatuan.com',
      'accounts.hbbtzn.com',
    )).toBe('?target=console-hbbtzn&client=console-hbbtzn&admin_origin=https%3A%2F%2Fconsole.hbbtzn.com');
  });

  it('does not rewrite a valid local entry or an unknown identity hostname', () => {
    expect(recoverLocalIdentitySearch(
      '?target=storefront-hbbtzn&surface=web&application=zdt-l1-verify',
      'accounts.hbbtzn.com',
    )).toBeNull();
    expect(recoverLocalIdentitySearch('?target=console', 'untrusted.example.com')).toBeNull();
  });

  it('accepts an L11 node added only through registry data', () => {
    const l11Registry = parseIdentityNodeRegistry(JSON.stringify({
      version: 1,
      defaultNodeId: 'l11',
      nodes: [{
        nodeId: 'l11', displayName: 'L11 运营后台', accountsOrigin: 'https://accounts.l11.example.com',
        apiOrigin: 'https://api.l11.example.com', consumerApiOrigin: 'https://l11.example.com',
        adminOrigin: 'https://console.l11.example.com', storefrontOrigin: 'https://l11.example.com',
        adminTarget: 'console', consumerTarget: 'storefront', consumerApplication: 'l11-storefront',
      }],
    }));
    expect(resolveIdentityEntry(
      '?target=storefront&surface=web&application=l11-storefront', 'accounts.l11.example.com', l11Registry,
    )).toMatchObject({ kind: 'consumer', nodeId: 'l11', application: 'l11-storefront', target: 'storefront' });
    expect(resolveIdentityEntry('', 'accounts.l11.example.com', l11Registry))
      .toMatchObject({ kind: 'operator', nodeId: 'l11', target: 'console' });
    expect(resolveIdentityEntry('', 'accounts.l10.example.com', l11Registry)).toBeNull();
  });
});
