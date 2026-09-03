import { describe, expect, it } from 'vitest';
import { validateAuthBuildEnvironment } from './buildEnvironment';

const production = Object.freeze({
  APP_ENV: 'production',
  VITE_API_BASE_URL: 'https://api.zhudatuan.com',
  VITE_ADMIN_ORIGIN: 'https://console.zhudatuan.com',
  VITE_STOREFRONT_ORIGIN: 'https://hbbtzn.com',
  VITE_CLIENT_VERSION: '1.0.0',
});

describe('auth production build environment', () => {
  it('requires every browser runtime value at build time', () => {
    expect(validateAuthBuildEnvironment(production)).toEqual({
      apiBaseUrl: 'https://api.zhudatuan.com',
      adminOrigin: 'https://console.zhudatuan.com',
      storefrontOrigin: 'https://hbbtzn.com',
      clientVersion: '1.0.0',
    });
    for (const key of Object.keys(production).filter((key) => key !== 'APP_ENV')) {
      expect(() => validateAuthBuildEnvironment({ ...production, [key]: undefined })).toThrow(/_MISSING$/);
    }
  });

  it('rejects a client version that the runtime contract cannot send', () => {
    expect(() => validateAuthBuildEnvironment({ ...production, VITE_CLIENT_VERSION: 'ca046ae' }))
      .toThrow('AUTH_CLIENT_VERSION_INVALID');
  });

  it('keeps hbbtzn limited to the H5 destination, never the identity backend or admin', () => {
    expect(() => validateAuthBuildEnvironment({ ...production, VITE_API_BASE_URL: 'https://api.hbbtzn.com' }))
      .toThrow('AUTH_CLIENT_API_BASE_URL_INVALID');
    expect(() => validateAuthBuildEnvironment({ ...production, VITE_ADMIN_ORIGIN: 'https://smart.hbbtzn.com' }))
      .toThrow('AUTH_CLIENT_ADMIN_ORIGIN_INVALID');
    expect(() => validateAuthBuildEnvironment({ ...production, VITE_STOREFRONT_ORIGIN: 'https://mall.hbbtzn.com' }))
      .toThrow('AUTH_CLIENT_STOREFRONT_ORIGIN_INVALID');
  });
});
