import { describe, expect, it } from 'vitest';
import { isHongtaiConsoleEntry, resolveConsumerIdentityEntry } from './consumerIdentityEntry';

describe('consumer identity entry', () => {
  it('routes a declared storefront application to the consumer adapter', () => {
    expect(resolveConsumerIdentityEntry('?target=storefront&surface=web&application=zdt-l1-verify')).toEqual({
      application: 'zdt-l1-verify',
    });
    expect(resolveConsumerIdentityEntry('?target=storefront&application=another-mall')).toEqual({ application: 'another-mall' });
    expect(resolveConsumerIdentityEntry('?target=storefront&application=INVALID_APP')).toBeNull();
    expect(resolveConsumerIdentityEntry('?client=console-hbbtzn&application=zdt-l1-verify')).toBeNull();
  });
});

describe('operator identity entry', () => {
  it('recognizes both canonical and existing Hongtai console links', () => {
    expect(isHongtaiConsoleEntry('?target=console-hbbtzn')).toBe(true);
    expect(isHongtaiConsoleEntry('?client=console-hbbtzn')).toBe(true);
    expect(isHongtaiConsoleEntry('?target=console')).toBe(false);
    expect(isHongtaiConsoleEntry('?target=storefront&application=zdt-l1-verify')).toBe(false);
  });
});
