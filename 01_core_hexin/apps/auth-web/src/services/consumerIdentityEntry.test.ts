import { describe, expect, it } from 'vitest';
import {
  isHongtaiConsoleEntry,
  recoverLocalIdentitySearch,
  resolveConsumerIdentityEntry,
  resolveIdentityEntry,
} from './consumerIdentityEntry';

describe('consumer identity entry', () => {
  it('routes a declared storefront application to the consumer adapter', () => {
    expect(resolveConsumerIdentityEntry('?target=storefront-hbbtzn&surface=web&application=zdt-l1-verify')).toEqual({
      application: 'zdt-l1-verify',
      target: 'storefront-hbbtzn',
    });
    expect(resolveConsumerIdentityEntry('?target=storefront&application=zhudatuan-storefront')).toEqual({
      application: 'zhudatuan-storefront',
      target: 'storefront',
    });
    expect(resolveConsumerIdentityEntry('?target=storefront&application=zdt-l1-verify')).toBeNull();
    expect(resolveConsumerIdentityEntry('?target=storefront-hbbtzn&application=zhudatuan-storefront')).toBeNull();
    expect(resolveConsumerIdentityEntry('?target=storefront&application=another-mall')).toBeNull();
    expect(resolveConsumerIdentityEntry('?target=storefront&application=INVALID_APP')).toBeNull();
    expect(resolveConsumerIdentityEntry('?client=console-hbbtzn&application=zdt-l1-verify')).toBeNull();
  });
});

describe('operator identity entry', () => {
  it('recognizes both canonical and existing Hongtai console links', () => {
    expect(isHongtaiConsoleEntry('?target=console-hbbtzn')).toBe(true);
    expect(isHongtaiConsoleEntry('?client=console-hbbtzn')).toBe(true);
    expect(isHongtaiConsoleEntry('?target=console')).toBe(false);
    expect(isHongtaiConsoleEntry('?target=storefront-hbbtzn&application=zdt-l1-verify')).toBe(false);
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
    expect(resolveIdentityEntry('', 'accounts.zhudatuan.com')).toEqual({ kind: 'operator', target: 'console' });
    expect(resolveIdentityEntry('', 'accounts.hbbtzn.com')).toEqual({ kind: 'operator', target: 'console-hbbtzn' });
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
});
