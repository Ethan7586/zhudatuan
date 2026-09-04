import { processEnvironment, requiredValue, type EnvironmentSource } from './Environment';

export interface SmokeEnvironment {
  readonly baseUrl: string;
  readonly release: string;
}

export function smokeEnvironment(source: EnvironmentSource = processEnvironment()): SmokeEnvironment {
  const baseUrl = requiredValue(source.SHOP_SMOKE_BASE_URL, 'SHOP_SMOKE_BASE_URL_MISSING').replace(/\/$/, '');
  const release = requiredValue(source.SHOP_SMOKE_RELEASE, 'SHOP_SMOKE_RELEASE_MISSING');
  if (!/^https:\/\//.test(baseUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(baseUrl)
    && !/^http:\/\/[a-z0-9-]+\.[a-z0-9-]+\.svc\.cluster\.local(?::\d+)?$/i.test(baseUrl)) throw new Error('SHOP_SMOKE_BASE_URL_INVALID');
  if (!/^[a-z0-9]{8,64}$/.test(release)) throw new Error('SHOP_SMOKE_RELEASE_INVALID');
  return Object.freeze({ baseUrl, release });
}
