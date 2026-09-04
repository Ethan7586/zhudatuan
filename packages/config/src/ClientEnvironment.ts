import { browserEnvironment, pickEnvironment, type EnvironmentSource } from './Environment';
import { CLIENT_BY_ID, CLIENT_LOCAL_ORIGINS, CLIENT_ORIGINS, CLIENT_TARGETS, type ClientSurface, type ClientTarget } from './ClientCatalog';
import { NETWORK_CATALOG } from './NetworkCatalog';

export const CANONICAL_API_ORIGIN = NETWORK_CATALOG.origins.api;
export const CANONICAL_AUTH_ORIGIN = NETWORK_CATALOG.origins.auth;
export const CANONICAL_CONSOLE_ORIGIN = NETWORK_CATALOG.origins.console;
export const CANONICAL_STOREFRONT_ORIGIN = NETWORK_CATALOG.origins.storefront;
export const CANONICAL_MINIAPP_ORIGIN = NETWORK_CATALOG.origins.miniapp;
export const CANONICAL_STORE_ORIGIN = NETWORK_CATALOG.origins.store;
export const CANONICAL_SUPPLIER_ORIGIN = NETWORK_CATALOG.origins.supplier;
export const STOREFRONT_ENTRY_PATH = NETWORK_CATALOG.storefront.entryPath;
export const LOCAL_API_ORIGIN = 'http://127.0.0.1:3001';
export const LOCAL_AUTH_ORIGIN = 'http://127.0.0.1:3002';
export const LOCAL_CONSOLE_ORIGIN = 'http://127.0.0.1:4173';
export const LOCAL_STOREFRONT_ORIGIN = 'http://127.0.0.1:3000';
export const LOCAL_MINIAPP_ORIGIN = CLIENT_LOCAL_ORIGINS.miniapp;
export const LOCAL_STORE_ORIGIN = CLIENT_LOCAL_ORIGINS.store;
export const LOCAL_SUPPLIER_ORIGIN = CLIENT_LOCAL_ORIGINS.supplier;

export const CLIENT_ENVIRONMENT_KEYS = ['MODE', 'VITE_API_BASE_URL', 'VITE_AUTH_BASE_URL', 'VITE_STOREFRONT_ORIGIN', 'VITE_CLIENT_VERSION'] as const;
export const AUTH_ENVIRONMENT_KEYS = ['MODE', 'VITE_API_BASE_URL', 'VITE_CONSOLE_ORIGIN', 'VITE_STOREFRONT_ORIGIN', 'VITE_MINIAPP_ORIGIN', 'VITE_STORE_ORIGIN', 'VITE_SUPPLIER_ORIGIN', 'VITE_CLIENT_VERSION'] as const;
export const STOREFRONT_ENVIRONMENT_KEYS = ['MODE', 'VITE_API_BASE_URL', 'VITE_AUTH_BASE_URL', 'VITE_CLIENT_VERSION'] as const;

export type AuthTarget = ClientTarget;

export interface ClientEnvironment {
  readonly apiBaseUrl: string;
  readonly authBaseUrl: string;
  readonly storefrontOrigin: string;
  readonly clientVersion: string;
}

export interface AuthClientEnvironment {
  readonly apiOrigin: string;
  readonly consoleOrigin: string;
  readonly storefrontOrigin: string;
  readonly returnOrigins: Readonly<Record<AuthTarget, string>>;
  readonly clientVersion: string;
}

export interface SurfaceClientEnvironment {
  readonly surface: Exclude<ClientSurface, 'auth'>;
  readonly target: AuthTarget;
  readonly apiOrigin: string;
  readonly authOrigin: string;
  readonly clientVersion: string;
}

export interface StorefrontClientEnvironment {
  readonly apiOrigin: string;
  readonly authOrigin: string;
  readonly clientVersion: string;
}

export function clientEnvironment(source: EnvironmentSource = browserEnvironment()): ClientEnvironment {
  const values = pickEnvironment(source, CLIENT_ENVIRONMENT_KEYS);
  const development = values.MODE !== 'production';
  return Object.freeze({
    apiBaseUrl: approvedOrigin(values.VITE_API_BASE_URL, CANONICAL_API_ORIGIN, LOCAL_API_ORIGIN, development, 'CLIENT_API_BASE_URL_INVALID'),
    authBaseUrl: approvedOrigin(values.VITE_AUTH_BASE_URL, CANONICAL_AUTH_ORIGIN, LOCAL_AUTH_ORIGIN, development, 'CLIENT_AUTH_BASE_URL_INVALID'),
    storefrontOrigin: approvedOrigin(values.VITE_STOREFRONT_ORIGIN, CANONICAL_STOREFRONT_ORIGIN, LOCAL_STOREFRONT_ORIGIN, development, 'CLIENT_STOREFRONT_ORIGIN_INVALID'),
    clientVersion: version(values.VITE_CLIENT_VERSION, development),
  });
}

export function authClientEnvironment(source: EnvironmentSource = browserEnvironment()): AuthClientEnvironment {
  const values = pickEnvironment(source, AUTH_ENVIRONMENT_KEYS);
  const development = values.MODE !== 'production';
  const returnOrigins = Object.freeze({
    console: approvedOrigin(values.VITE_CONSOLE_ORIGIN, CANONICAL_CONSOLE_ORIGIN, LOCAL_CONSOLE_ORIGIN, development, 'AUTH_CONSOLE_ORIGIN_INVALID'),
    storefront: approvedOrigin(values.VITE_STOREFRONT_ORIGIN, CANONICAL_STOREFRONT_ORIGIN, LOCAL_STOREFRONT_ORIGIN, development, 'AUTH_STOREFRONT_ORIGIN_INVALID'),
    miniapp: approvedOrigin(values.VITE_MINIAPP_ORIGIN, CANONICAL_MINIAPP_ORIGIN, LOCAL_MINIAPP_ORIGIN, development, 'AUTH_MINIAPP_ORIGIN_INVALID'),
    store: approvedOrigin(values.VITE_STORE_ORIGIN, CANONICAL_STORE_ORIGIN, LOCAL_STORE_ORIGIN, development, 'AUTH_STORE_ORIGIN_INVALID'),
    supplier: approvedOrigin(values.VITE_SUPPLIER_ORIGIN, CANONICAL_SUPPLIER_ORIGIN, LOCAL_SUPPLIER_ORIGIN, development, 'AUTH_SUPPLIER_ORIGIN_INVALID'),
  });
  return Object.freeze({
    apiOrigin: approvedOrigin(values.VITE_API_BASE_URL, CANONICAL_API_ORIGIN, LOCAL_API_ORIGIN, development, 'AUTH_API_ORIGIN_INVALID'),
    consoleOrigin: returnOrigins.console,
    storefrontOrigin: returnOrigins.storefront,
    returnOrigins,
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

export function surfaceClientEnvironment(surface: Exclude<ClientSurface, 'auth'>, source: EnvironmentSource = browserEnvironment()): SurfaceClientEnvironment {
  const client = CLIENT_BY_ID.get(surface);
  if (client === undefined || client.target === null) throw new Error('CLIENT_SURFACE_INVALID');
  const values = pickEnvironment(source, STOREFRONT_ENVIRONMENT_KEYS);
  const development = values.MODE !== 'production';
  return Object.freeze({
    surface,
    target: client.target,
    apiOrigin: approvedOrigin(values.VITE_API_BASE_URL, CANONICAL_API_ORIGIN, LOCAL_API_ORIGIN, development, `${surface.toUpperCase()}_API_ORIGIN_INVALID`),
    authOrigin: approvedOrigin(values.VITE_AUTH_BASE_URL, CANONICAL_AUTH_ORIGIN, LOCAL_AUTH_ORIGIN, development, `${surface.toUpperCase()}_AUTH_ORIGIN_INVALID`),
    clientVersion: version(values.VITE_CLIENT_VERSION, development),
  });
}

export function clientReturnOrigins(development: boolean): Readonly<Record<AuthTarget, string>> {
  return Object.freeze(
    Object.fromEntries(CLIENT_TARGETS.map((target) => [target, development ? CLIENT_LOCAL_ORIGINS[target] : CLIENT_ORIGINS[target]])) as Record<AuthTarget, string>
  );
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
