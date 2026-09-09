import { randomInt } from 'node:crypto';

export function localVerificationCode(current?: string): string {
  if (current !== undefined && /^\d{6}$/.test(current)) return current;
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}
