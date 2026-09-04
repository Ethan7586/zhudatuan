import type { Actor } from './AccessContext';

export interface SessionResolver {
  resolve(headers: Readonly<Record<string, string>>): Promise<Actor>;
}
