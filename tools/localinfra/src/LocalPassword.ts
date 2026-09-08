import { randomBytes } from 'node:crypto';
import { RUNTIME_LIMITS } from '@shop/config/runtime';

const POLICY = RUNTIME_LIMITS.authentication.password;
const TARGET_LENGTH = Math.min(POLICY.maximumLength, Math.max(POLICY.minimumLength, 32));
const REQUIRED = `${POLICY.uppercase ? 'A' : ''}${POLICY.lowercase ? 'a' : ''}${POLICY.number ? '1' : ''}${POLICY.symbol ? '!' : ''}`;

export function localPassword(current?: string): string {
  if (current && accepted(current)) return current;
  if (TARGET_LENGTH < REQUIRED.length) throw new Error('LOCAL_PASSWORD_POLICY_INVALID');
  const entropy = randomBytes(TARGET_LENGTH).toString('base64url').slice(0, TARGET_LENGTH - REQUIRED.length);
  const password = `${REQUIRED}${entropy}`;
  if (!accepted(password)) throw new Error('LOCAL_PASSWORD_POLICY_INVALID');
  return password;
}

function accepted(password: string): boolean {
  return (
    password.length >= POLICY.minimumLength &&
    password.length <= POLICY.maximumLength &&
    (!POLICY.uppercase || /[A-Z]/.test(password)) &&
    (!POLICY.lowercase || /[a-z]/.test(password)) &&
    (!POLICY.number || /\d/.test(password)) &&
    (!POLICY.symbol || /[^A-Za-z0-9]/.test(password))
  );
}
