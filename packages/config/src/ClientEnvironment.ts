import { browserEnvironment, pickEnvironment, requiredValue, type EnvironmentSource } from './Environment';

export const CANONICAL_API_ORIGIN = 'https://api.zhudatuan.com';
export const CANONICAL_AUTH_ORIGIN = 'https://accounts.zhudatuan.com';
export const CANONICAL_CONSOLE_ORIGIN = 'https://console.zhudatuan.com';
export const CANONICAL_STOREFRONT_ORIGIN = 'https://zhudatuan.com';
export const LOCAL_API_ORIGIN = 'http://127.0.0.1:3001';
export const LOCAL_AUTH_ORIGIN = 'http://127.0.0.1:3002';
export const LOCAL_CONSOLE_ORIGIN = 'http://127.0.0.1:4173';
export const LOCAL_STOREFRONT_ORIGIN = 'http://127.0.0.1:3000';

export const CLIENT_ENVIRONMENT_KEYS = ['VITE_API_BASE_URL', 'VITE_AUTH_BASE_URL', 'VITE_CLIENT_VERSION'] as const;
export const AUTH_ENVIRONMENT_KEYS = ['MODE', 'VITE_API_BASE_URL', 'VITE_ADMIN_ORIGIN', 'VITE_STOREFRONT_ORIGIN', 'VITE_CLIENT_VERSION'] as const;
export const STOREFRONT_ENVIRONMENT_KEYS = ['MODE', 'VITE_API_BASE_URL', 'VITE_AUTH_BASE_URL', 'VITE_CLIENT_VERSION'] as const;

export type AuthTarget = 'console' | 'storefront';

export interface ClientEnvironment {
  readonly apiBaseUrl: string;
  readonly authBaseUrl: string;
  readonly clientVersion: string;
}

export interface AuthClientEnvironment {
  readonly apiOrigin: string;
  readonly consoleOrigin: string;
  readonly storefrontOrigin: string;
  readonly clientVersion: string;
}

export interface StorefrontClientEnvironment {
  readonly apiOrigin: string;
  readonly authOrigin: string;
  readonly clientVersion: string;
}

export function clientEnvironment(source: EnvironmentSource = browserEnvironment()): ClientEnvironment {
  const values = pickEnvironment(source, CLIENT_ENVIRONMENT_KEYS);
  const apiBaseUrl = requiredValue(values.VITE_API_BASE_URL, 'CLIENT_API_BASE_URL_MISSING');
  const authBaseUrl = requiredValue(values.VITE_AUTH_BASE_URL, 'CLIENT_AUTH_BASE_URL_MISSING');
  return Object.freeze({
    apiBaseUrl: webOrigin(apiBaseUrl, 'CLIENT_API_BASE_URL_INVALID'),
    authBaseUrl: webOrigin(authBaseUrl, 'CLIENT_AUTH_BASE_URL_INVALID'),
    clientVersion: version(values.VITE_CLIENT_VERSION, false),
  });
}

export function authClientEnvironment(source: EnvironmentSource = browserEnvironment()): AuthClientEnvironment {
  const values = pickEnvironment(source, AUTH_ENVIRONMENT_KEYS);
  const development = values.MODE !== 'production';
  return Object.freeze({
    apiOrigin: approvedOrigin(values.VITE_API_BASE_URL, CANONICAL_API_ORIGIN, LOCAL_API_ORIGIN, development, 'AUTH_API_ORIGIN_INVALID'),
    consoleOrigin: approvedOrigin(values.VITE_ADMIN_ORIGIN, CANONICAL_CONSOLE_ORIGIN, LOCAL_CONSOLE_ORIGIN, development, 'AUTH_CONSOLE_ORIGIN_INVALID'),
    storefrontOrigin: approvedOrigin(values.VITE_STOREFRONT_ORIGIN, CANONICAL_STOREFRONT_ORIGIN, LOCAL_STOREFRONT_ORIGIN, development, 'AUTH_STOREFRONT_ORIGIN_INVALID'),
    clientVersion: version(values.VITE_CLIENT_VERSION, development),
  });
}

export function storefrontClientEnvironment(source: EnvironmentSource = browserEnvironment()): StorefrontClientEnvironment {
  const values = pickEnvironment(source, STOREFRONT_ENVIRONMENT_KEYS);
  const development = values.MODE !== 'production';
  return Object.freeze({
    apiOrigin: approvedOrigin(values.VITE_API_BASE_URL, CANONICAL_API_ORIGIN, LOCAL_API_ORIGIN, development, 'STOREFRONT_API_ORIGIN_INVALID'),
    authOrigin: approvedOrigin(values.VITE_AUTH_BASE_URL, CANONICAL_AUTH_ORIGIN, LOCAL_AUTH_ORIGIN, development, 'STOREFRONT_AUTH_ORIGIN_INVALID'),
    clientVersion: version(values.VITE_CLIENT_VERSION, development),
  });
}

export function resolveStorefrontAuthOrigin(candidate: string | undefined, environment: string | undefined): string {
  return approvedOrigin(candidate, CANONICAL_AUTH_ORIGIN, LOCAL_AUTH_ORIGIN, environment !== 'production', 'STOREFRONT_AUTH_ORIGIN_INVALID');
}

function approvedOrigin(candidate: string | undefined, canonical: string, local: string, development: boolean, code: string): string {
  const origin = webOrigin(candidate?.trim() || (development ? local : canonical), code);
  const localhost = new Set([local, local.replace('127.0.0.1', 'localhost')]);
  if (origin !== canonical && !(development && localhost.has(origin))) throw new Error(code);
  return origin;
}

function webOrigin(value: string, code: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(code);
  }
  if (parsed.username || parsed.password || parsed.hash || (parsed.pathname !== '/' && parsed.pathname !== '') || parsed.search || !['http:', 'https:'].includes(parsed.protocol)) throw new Error(code);
  return parsed.origin;
}

function version(value: string | undefined, development: boolean): string {
  const normalized = value?.trim() || (development ? '0.0.0' : '');
  if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.]+)?$/i.test(normalized)) throw new Error('CLIENT_VERSION_INVALID');
  return normalized;
}
