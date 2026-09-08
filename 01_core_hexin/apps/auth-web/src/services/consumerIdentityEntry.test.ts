import { describe, expect, it } from 'vitest';
import {
  resolveConsumerIdentityEntry,
  resolveIdentityEntry,
} from './consumerIdentityEntry';
import { configuredIdentityNodeRegistry, currentLoginIntent } from './identityNodeEnvironment';
import { parseIdentityNodeRegistry, PRODUCTION_IDENTITY_NODE_REGISTRY_SOURCE } from '@shop/sdk/identity-node';

const registry = configuredIdentityNodeRegistry(PRODUCTION_IDENTITY_NODE_REGISTRY_SOURCE);
const l0 = registry.nodes.find((node) => node.nodeId === 'node:zhudatuan:l0')!;
const l1 = registry.nodes.find((node) => node.nodeId === 'node:hbbtzn:l1')!;

describe('cross-node login intent', () => {
  it('accepts one opaque intent and rejects malformed or duplicated values', () => {
    const token = 'x'.repeat(64);
    expect(currentLoginIntent(`?login_intent=${token}`)).toBe(token);
    expect(currentLoginIntent('?target=storefront')).toBeUndefined();
    expect(() => currentLoginIntent('?login_intent=short')).toThrow('跨节点登录凭证无效');
    expect(() => currentLoginIntent(`?login_intent=${token}&login_intent=${token}`)).toThrow('跨节点登录凭证无效');
  });
});

describe('consumer identity entry', () => {
  it('routes a declared storefront application to the consumer adapter', () => {
    expect(resolveConsumerIdentityEntry('?target=storefront&surface=web&application=zdt-l1-verify', l1)).toEqual({
      application: 'zdt-l1-verify',
      target: 'storefront',
    });
    expect(resolveConsumerIdentityEntry('?target=storefront&application=zhudatuan-storefront', l0)).toEqual({
      application: 'zhudatuan-storefront',
      target: 'storefront',
    });
    expect(resolveConsumerIdentityEntry('?target=storefront-hbbtzn&application=zdt-l1-verify', l1)).toBeNull();
    expect(resolveConsumerIdentityEntry('?target=storefront-hbbtzn&application=zhudatuan-storefront', l0)).toBeNull();
    expect(resolveConsumerIdentityEntry('?target=storefront&application=another-mall', l0)).toBeNull();
    expect(resolveConsumerIdentityEntry('?target=storefront&application=INVALID_APP', l0)).toBeNull();
    expect(resolveConsumerIdentityEntry('?client=console&application=zdt-l1-verify', l1)).toBeNull();
  });
});

describe('node-bound identity entry', () => {
  it('accepts only the consumer application belonging to the current accounts host', () => {
    expect(resolveIdentityEntry(
      '?target=storefront&application=zhudatuan-storefront', 'accounts.zhudatuan.com',
    )).toMatchObject({ kind: 'consumer', target: 'storefront' });
    expect(resolveIdentityEntry(
      '?target=storefront&application=zdt-l1-verify', 'accounts.hbbtzn.com',
    )).toMatchObject({ kind: 'consumer', target: 'storefront' });
    expect(resolveIdentityEntry(
      '?target=storefront&application=zhudatuan-storefront', 'accounts.hbbtzn.com',
    )).toBeNull();
    expect(resolveIdentityEntry(
      '?target=storefront&application=zdt-l1-verify', 'accounts.zhudatuan.com',
    )).toBeNull();
  });

  it('binds operator targets to the current accounts host', () => {
    expect(resolveIdentityEntry('', 'accounts.zhudatuan.com')).toMatchObject({ kind: 'operator', nodeId: 'node:zhudatuan:l0', target: 'console' });
    expect(resolveIdentityEntry('', 'accounts.hbbtzn.com')).toMatchObject({ kind: 'operator', nodeId: 'node:hbbtzn:l1', target: 'console' });
    expect(resolveIdentityEntry('?target=console', 'accounts.hbbtzn.com')).toMatchObject({ kind: 'operator', nodeId: 'node:hbbtzn:l1' });
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

  it('rejects unsigned cross-node parameters instead of rewriting them', () => {
    expect(resolveIdentityEntry(
      '?target=storefront&surface=web&application=zdt-l1-verify', 'accounts.zhudatuan.com',
    )).toBeNull();
    expect(resolveIdentityEntry(
      '?target=storefront&surface=web&application=zhudatuan-storefront', 'accounts.hbbtzn.com',
    )).toBeNull();
    expect(resolveIdentityEntry(
      '?target=console&client=console&admin_origin=https%3A%2F%2Fconsole.hbbtzn.com', 'accounts.zhudatuan.com',
    )).toBeNull();
  });

  it('accepts an L11 consumer node but never exposes an operator entry', () => {
    const l11Registry = parseIdentityNodeRegistry(JSON.stringify({
      version: 2,
      nodes: [{
        nodeId: 'node:example:l5', nodeProfile: 'operating_mall', mallId: 'mall:l5', displayName: 'L5 商城',
        accountsOrigin: 'https://accounts.l5.example.com', apiOrigin: 'https://api.l5.example.com',
        consumerApiOrigin: 'https://l5.example.com', adminOrigin: 'https://console.l5.example.com',
        storefrontOrigin: 'https://l5.example.com', adminTarget: 'console',
        consumerTarget: 'storefront', consumerApplication: 'l5-storefront',
      }, {
        nodeId: 'node:example:l11', nodeProfile: 'consumer', hostNodeId: 'node:example:l5', displayName: 'L11 消费者',
        accountsOrigin: 'https://accounts.l11.example.com',
        apiOrigin: 'https://api.l11.example.com', consumerApiOrigin: 'https://l11.example.com',
        storefrontOrigin: 'https://l11.example.com', consumerTarget: 'storefront',
        consumerApplication: 'l11-storefront',
      }],
    }));
    expect(resolveIdentityEntry(
      '?target=storefront&surface=web&application=l11-storefront', 'accounts.l11.example.com', l11Registry,
    )).toMatchObject({ kind: 'consumer', nodeId: 'node:example:l11', application: 'l11-storefront', target: 'storefront' });
    expect(resolveIdentityEntry('', 'accounts.l11.example.com', l11Registry)).toBeNull();
    expect(resolveIdentityEntry(
      '?target=console&client=console&admin_origin=https%3A%2F%2Fconsole.l5.example.com',
      'accounts.l11.example.com', l11Registry,
    )).toBeNull();
    expect(resolveIdentityEntry('', 'accounts.l10.example.com', l11Registry)).toBeNull();
  });
});
