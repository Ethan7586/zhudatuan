import { token } from '../../bootstrap/Container';

export interface CacheState {
  readonly available: boolean;
  readonly reason?: string;
}

export interface Cache {
  start(): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  put<T>(key: string, value: T, seconds: number): Promise<boolean>;
  remove(...keys: readonly string[]): Promise<boolean>;
  state(): CacheState;
  close(): Promise<void>;
}

export const CACHE = token<Cache>('cache');
