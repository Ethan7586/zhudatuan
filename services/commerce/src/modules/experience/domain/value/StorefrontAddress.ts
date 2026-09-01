import { parseStorefrontHandle, storefrontEntryUrl, type StorefrontHandle } from '@shop/contract';

export class StorefrontAddress {
  readonly handle: StorefrontHandle;
  readonly url: string;

  private constructor(handle: StorefrontHandle, url: string) {
    this.handle = handle;
    this.url = url;
    Object.freeze(this);
  }

  static from(handle: unknown, config: Readonly<{ origin: string; entryPath: string }>): StorefrontAddress {
    const parsed = parseStorefrontHandle(handle);
    return new StorefrontAddress(parsed, storefrontEntryUrl(config.origin, config.entryPath, parsed));
  }
}
