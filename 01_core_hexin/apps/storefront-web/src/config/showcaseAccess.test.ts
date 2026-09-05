import { describe, expect, it } from 'vitest';
import { isLabsApiPathBlocked, isShowcaseHostAllowed, isShowcasePath, isStorefrontRuntimeConfigurationAllowed } from './showcaseAccess';

describe('showcase host boundary', () => {
  it.each(['/desktop-1920', '/desktop-1920/inspect', '/mini-program', '/android-app/detail', '/tablet-app', '/laptop-web'])('recognizes preview-only path %s', (path) => {
    expect(isShowcasePath(path)).toBe(true);
  });

  it.each(['/', '/api/v1/products', '/login', '/desktop'])('does not block production path %s', (path) => {
    expect(isShowcasePath(path)).toBe(false);
  });

  it('allows previews only on labs or an explicit local development host', () => {
    expect(isShowcaseHostAllowed('labs.zhudatuan.com', 'production')).toBe(true);
    expect(isShowcaseHostAllowed('zhudatuan.com', 'production')).toBe(false);
    expect(isShowcaseHostAllowed('www.zhudatuan.com', 'production')).toBe(false);
    expect(isShowcaseHostAllowed('127.0.0.1', 'development')).toBe(true);
    expect(isShowcaseHostAllowed('localhost', undefined)).toBe(true);
    expect(isShowcaseHostAllowed('127.0.0.1', 'production')).toBe(false);
  });

  it('prevents the labs preview host from reaching the compatibility API', () => {
    expect(isLabsApiPathBlocked('labs.zhudatuan.com', '/api/health')).toBe(true);
    expect(isLabsApiPathBlocked('labs.zhudatuan.com', '/api/v1/auth/login')).toBe(true);
    expect(isLabsApiPathBlocked('labs.zhudatuan.com', '/api/v1/orders')).toBe(true);
    expect(isLabsApiPathBlocked('labs.zhudatuan.com', '/laptop-web')).toBe(false);
    expect(isLabsApiPathBlocked('zhudatuan.com', '/api/v1/orders')).toBe(false);
  });

  it('fails closed when a production storefront host could enable development authentication', () => {
    expect(isStorefrontRuntimeConfigurationAllowed('zhudatuan.com', 'production', 'membership')).toBe(true);
    expect(isStorefrontRuntimeConfigurationAllowed('www.zhudatuan.com', 'production', 'membership')).toBe(true);
    expect(isStorefrontRuntimeConfigurationAllowed('internal.zhudatuan.com', 'production', 'membership')).toBe(true);
    expect(isStorefrontRuntimeConfigurationAllowed('internal.zhudatuan.com', 'development', 'development')).toBe(false);
    expect(isStorefrontRuntimeConfigurationAllowed('accounts.zhudatuan.com', 'production', 'membership')).toBe(true);
    expect(isStorefrontRuntimeConfigurationAllowed('console.zhudatuan.com', 'production', 'membership')).toBe(true);
    expect(isStorefrontRuntimeConfigurationAllowed('zhudatuan.com', 'development', 'development')).toBe(false);
    expect(isStorefrontRuntimeConfigurationAllowed('zhudatuan.com', undefined, undefined)).toBe(false);
    expect(isStorefrontRuntimeConfigurationAllowed('accounts.zhudatuan.com', 'development', 'development')).toBe(false);
    expect(isStorefrontRuntimeConfigurationAllowed('accounts.zhudatuan.com', undefined, undefined)).toBe(false);
    expect(isStorefrontRuntimeConfigurationAllowed('console.zhudatuan.com', 'development', 'development')).toBe(false);
    expect(isStorefrontRuntimeConfigurationAllowed('console.zhudatuan.com', undefined, undefined)).toBe(false);
    expect(isStorefrontRuntimeConfigurationAllowed('labs.zhudatuan.com', 'development', 'development')).toBe(true);
    expect(isStorefrontRuntimeConfigurationAllowed('127.0.0.1', undefined, undefined)).toBe(true);
    expect(isStorefrontRuntimeConfigurationAllowed('127.0.0.1', 'production', 'membership')).toBe(false);
    expect(isStorefrontRuntimeConfigurationAllowed('hbbtzn.com', 'production', 'membership')).toBe(false);
    expect(isStorefrontRuntimeConfigurationAllowed('smart.hbbtzn.com', 'production', 'membership')).toBe(false);
    expect(isStorefrontRuntimeConfigurationAllowed('attacker.example', 'production', 'membership')).toBe(false);
  });
});
