import { createHash } from 'node:crypto';

/** Canonical, non-secret fingerprint for immutable finance execution evidence. */
export function financeFingerprint(parts: readonly (string | number)[]): string {
  return createHash('sha256').update(parts.join('\u001f')).digest('hex');
}
