import type { Id } from './Id';

export interface IdGenerator {
  next(prefix: string): Id;
}
