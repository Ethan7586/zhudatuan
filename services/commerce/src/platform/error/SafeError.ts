import { ApplicationError } from './ApplicationError';
import { Failure } from './Failure';

/** Returns a bounded catalog code for persistence, metrics and health responses without exposing exception text. */
export function safeErrorCode(cause: unknown, fallback: string): string {
  return cause instanceof ApplicationError || cause instanceof Failure ? cause.code : fallback;
}

/** Reads only an explicit transport code used for control flow; arbitrary Error.message is never trusted. */
export function transportErrorCode(cause: unknown): string | null {
  if (cause === null || typeof cause !== 'object' || !('code' in cause)) return null;
  const code = Reflect.get(cause, 'code');
  return typeof code === 'string' && /^[A-Z][A-Z0-9_]{2,63}$/.test(code) ? code : null;
}
