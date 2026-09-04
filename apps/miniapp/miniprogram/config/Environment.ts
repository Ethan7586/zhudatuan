import { CLIENT_BY_ID } from '@shop/config/clientcatalog';
import { miniappEnvironment } from '@shop/config/miniapp';
import { parseStorefrontHandle, type StorefrontHandle } from '@shop/contract';

export interface MiniappRuntimeEnvironment {
  readonly apiOrigin: string;
  readonly authOrigin: string;
  readonly clientVersion: string;
  readonly ownOrigin: string;
  readonly storefrontHandle: StorefrontHandle;
}

export function readMiniappEnvironment(): MiniappRuntimeEnvironment {
  const ext = wx.getExtConfigSync().extConfig ?? {};
  const mode = text(ext.mode, 'MINIAPP_MODE_REQUIRED');
  if (!['development', 'production', 'test'].includes(mode)) throw new Error('MINIAPP_MODE_INVALID');
  const environment = miniappEnvironment({
    MODE: mode,
    VITE_API_BASE_URL: optionalText(ext.apiBaseUrl),
    VITE_AUTH_BASE_URL: optionalText(ext.authBaseUrl),
    VITE_CLIENT_VERSION: optionalText(ext.clientVersion),
  });
  const catalog = CLIENT_BY_ID.get('miniapp');
  if (catalog === undefined) throw new Error('MINIAPP_CLIENT_CATALOG_MISSING');
  return Object.freeze({
    apiOrigin: environment.apiOrigin,
    authOrigin: environment.authOrigin,
    clientVersion: environment.clientVersion,
    ownOrigin: mode === 'production' ? catalog.origin : catalog.localOrigin,
    storefrontHandle: parseStorefrontHandle(ext.storefrontHandle),
  });
}

function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(code);
  return value.trim();
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}
