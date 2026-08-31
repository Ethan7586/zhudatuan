import { storefrontClientEnvironment } from '@shop/config/client';

export function storefrontAuthHref(): string {
  return `${storefrontClientEnvironment().authOrigin}/`;
}
