export interface AuthBuildEnvironment {
  readonly apiBaseUrl: string;
  readonly adminOrigin: string;
  readonly storefrontOrigin: string;
  readonly h5Origin: string;
  readonly miniProgramOrigin: string;
  readonly clientVersion: string;
}

export function validateAuthBuildEnvironment(source: Readonly<Record<string, string | undefined>>): AuthBuildEnvironment {
  const apiBaseUrl = required(source.VITE_API_BASE_URL, 'AUTH_CLIENT_API_BASE_URL_MISSING');
  const adminOrigin = required(source.VITE_ADMIN_ORIGIN, 'AUTH_CLIENT_ADMIN_ORIGIN_MISSING');
  const storefrontOrigin = required(source.VITE_STOREFRONT_ORIGIN, 'AUTH_CLIENT_STOREFRONT_ORIGIN_MISSING');
  const h5Origin = required(source.VITE_H5_ORIGIN, 'AUTH_CLIENT_H5_ORIGIN_MISSING');
  const miniProgramOrigin = required(source.VITE_MINI_PROGRAM_ORIGIN, 'AUTH_CLIENT_MINI_PROGRAM_ORIGIN_MISSING');
  const clientVersion = required(source.VITE_CLIENT_VERSION, 'AUTH_CLIENT_VERSION_MISSING');
  if (source.APP_ENV === 'production') {
    if (apiBaseUrl !== 'https://api.zhudatuan.com') throw new Error('AUTH_CLIENT_API_BASE_URL_INVALID');
    if (adminOrigin !== 'https://console.zhudatuan.com') throw new Error('AUTH_CLIENT_ADMIN_ORIGIN_INVALID');
    if (storefrontOrigin !== 'https://zhudatuan.com') throw new Error('AUTH_CLIENT_STOREFRONT_ORIGIN_INVALID');
    if (h5Origin !== 'https://h5.zhudatuan.com') throw new Error('AUTH_CLIENT_H5_ORIGIN_INVALID');
    if (miniProgramOrigin !== 'https://mini.zhudatuan.com') throw new Error('AUTH_CLIENT_MINI_PROGRAM_ORIGIN_INVALID');
  }
  if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.]+)?$/i.test(clientVersion)) throw new Error('AUTH_CLIENT_VERSION_INVALID');
  return Object.freeze({ apiBaseUrl, adminOrigin, storefrontOrigin, h5Origin, miniProgramOrigin, clientVersion });
}

function required(value: string | undefined, code: string): string {
  if (!value?.trim()) throw new Error(code);
  return value.trim();
}
