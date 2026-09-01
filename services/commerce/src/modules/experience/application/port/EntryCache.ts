import type { StorefrontEntry } from './EntryRepository';

export interface EntryCache {
  read(handle: string): Promise<StorefrontEntry | null>;
  write(entry: StorefrontEntry): Promise<void>;
  remove(handle: string): Promise<void>;
}
