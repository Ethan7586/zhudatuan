import { describe, expect, it } from 'vitest';
import { isHongtaiConsoleEntry, resolveConsumerIdentityEntry } from './consumerIdentityEntry';

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
