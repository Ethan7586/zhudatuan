import type { StorefrontSession } from './Session';

export function requireSession(value: StorefrontSession | null): StorefrontSession {
  if (!value) throw new Error('AUTHENTICATION_REQUIRED');
  return value;
}
