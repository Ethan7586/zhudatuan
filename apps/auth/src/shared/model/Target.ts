import type { AuthTarget } from '@shop/config/client';
import { CLIENT_BY_ID } from '@shop/config/clientcatalog';

export function targetTitle(target: AuthTarget): string {
  const client = CLIENT_BY_ID.get(target);
  if (!client || client.target !== target) throw new Error(`AUTH_TARGET_MISSING:${target}`);
  return client.title;
}
