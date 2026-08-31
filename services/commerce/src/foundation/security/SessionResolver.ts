import type { Actor } from './AccessContext';

export interface SessionResolver {
  resolve(headers: Readonly<Record<string, string>>, operation: string): Promise<Actor>;
}
