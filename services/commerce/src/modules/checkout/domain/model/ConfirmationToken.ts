import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { DomainError } from '../../../../platform/error/DomainError';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43,171}$/;

export function issueConfirmationToken(): string {
  return randomBytes(RUNTIME_LIMITS.checkout.confirmationTokenBytes).toString('base64url');
}

export function confirmationDigest(token: string): string {
  if (!TOKEN_PATTERN.test(token)) throw new DomainError('VALIDATION_FAILED', { field: 'confirmationToken' });
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function confirmationMatches(token: string, digest: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(digest)) return false;
  const actual = Buffer.from(confirmationDigest(token), 'hex');
  return timingSafeEqual(actual, Buffer.from(digest, 'hex'));
}
