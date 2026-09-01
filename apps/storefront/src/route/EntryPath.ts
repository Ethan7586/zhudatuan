import { STOREFRONT_ENTRY_PATH } from '@shop/config/client';
import { parseStorefrontHandle, type StorefrontHandle } from '@shop/contract';

export interface StorefrontEntryPath {
  readonly handle: StorefrontHandle;
  readonly basePath: string;
  readonly path: string;
}

export function readEntryPath(pathname: string): StorefrontEntryPath {
  const prefix = `${STOREFRONT_ENTRY_PATH}/`;
  if (!pathname.startsWith(prefix) || /[\\\u0000-\u001f\u007f]/.test(pathname)) throw new Error('STOREFRONT_ENTRY_PATH_INVALID');
  const remainder = pathname.slice(prefix.length);
  const boundary = remainder.indexOf('/');
  const rawHandle = boundary === -1 ? remainder : remainder.slice(0, boundary);
  const handle = parseStorefrontHandle(rawHandle);
  const path = boundary === -1 ? '/' : remainder.slice(boundary) || '/';
  if (path.startsWith('//')) throw new Error('STOREFRONT_ENTRY_PATH_INVALID');
  return Object.freeze({ handle, basePath: `${STOREFRONT_ENTRY_PATH}/${handle}`, path });
}

export function currentStorefrontHandle(): StorefrontHandle {
  return readEntryPath(window.location.pathname).handle;
}
