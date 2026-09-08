import { readEntryPath } from '../../route/EntryPath';

export function storefrontUrl(path: string, query: Readonly<Record<string, string>> = {}): string {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('STOREFRONT_SHARE_PATH_INVALID');
  const entry = readEntryPath(window.location.pathname);
  const url = new URL(`${entry.basePath}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url.toString();
}
