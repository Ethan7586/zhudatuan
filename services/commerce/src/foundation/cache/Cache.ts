import { token } from '../../bootstrap/Container';

export interface CacheState {
  readonly available: boolean;
  readonly reason?: string;
}

export interface Cache {
  start(): Promise<void>;
<<<<<<< HEAD
<<<<<<< HEAD
  onUnavailable(listener: (state: CacheState) => void): () => void;
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  onUnavailable(listener: (state: CacheState) => void): () => void;
>>>>>>> 018b2a71 (chore(release): capture current production source)
  get<T>(key: string): Promise<T | null>;
  put<T>(key: string, value: T, seconds: number): Promise<boolean>;
  remove(...keys: readonly string[]): Promise<boolean>;
  state(): CacheState;
  close(): Promise<void>;
}

export const CACHE = token<Cache>('cache');
