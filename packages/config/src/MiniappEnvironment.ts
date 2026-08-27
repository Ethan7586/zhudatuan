import { requiredValue, type EnvironmentSource } from './Environment';

export const MINIAPP_ENVIRONMENT_SCHEMA = Object.freeze([
  { key: 'apiBaseUrl', pattern: '^https://[a-z0-9.-]+(?::[0-9]+)?(?:/[^?#]*)?$', code: 'MINIAPP_API_BASE_URL_INVALID' },
  { key: 'mallId', pattern: '^[a-zA-Z0-9:.-]{3,255}$', code: 'MINIAPP_MALL_ID_INVALID' },
  { key: 'clientVersion', pattern: '^[0-9]+\\.[0-9]+\\.[0-9]+$', code: 'MINIAPP_CLIENT_VERSION_INVALID' },
] as const);

export interface MiniappEnvironment {
  readonly apiBaseUrl: string;
  readonly mallId: string;
  readonly clientVersion: string;
}

export function miniappEnvironment(source: EnvironmentSource): MiniappEnvironment {
  const values: Record<string, string> = {};
  for (const field of MINIAPP_ENVIRONMENT_SCHEMA) {
    const value = requiredValue(source[field.key], field.code);
    if (!new RegExp(field.pattern, 'i').test(value)) throw new Error(field.code);
    values[field.key] = value;
  }
  return Object.freeze({ apiBaseUrl: values.apiBaseUrl!.replace(/\/$/, ''), mallId: values.mallId!, clientVersion: values.clientVersion! });
}

