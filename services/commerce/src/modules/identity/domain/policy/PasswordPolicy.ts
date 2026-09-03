import { randomBytes, scrypt as derive, timingSafeEqual } from 'node:crypto';
import type { Specification } from '../../../../foundation/domain/Specification';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { Bulkhead } from '@shop/kernel';
const VERSION = 'v1';
const COST = 32_768;
const BLOCK = 8;
const PARALLEL = 1;
const MAX_MEMORY = 64 * 1024 * 1024;
const POLICY = RUNTIME_LIMITS.authentication.password;
const WORKERS = new Bulkhead(POLICY.maximumConcurrency, POLICY.maximumQueue);
const PASSWORD_RULES: readonly Specification<string>[] = Object.freeze([
  { satisfiedBy: (password) => password.length >= POLICY.minimumLength && password.length <= POLICY.maximumLength },
  { satisfiedBy: (password) => !POLICY.uppercase || /[A-Z]/.test(password) },
  { satisfiedBy: (password) => !POLICY.lowercase || /[a-z]/.test(password) },
  { satisfiedBy: (password) => !POLICY.number || /\d/.test(password) },
  { satisfiedBy: (password) => !POLICY.symbol || /[^A-Za-z0-9]/.test(password) },
]);

function scrypt(password: string, salt: Buffer, length: number): Promise<Buffer> {
  return WORKERS.run(() => new Promise<Buffer>((resolve, reject) => derive(password, salt, length, { N: COST, r: BLOCK, p: PARALLEL, maxmem: MAX_MEMORY }, (cause, result) => (cause ? reject(cause) : resolve(result)))))
    .catch((cause: unknown) => {
      if (cause instanceof Error && cause.message === 'BULKHEAD_REJECTED') throw new DomainError('RATE_LIMITED', { retryAfter: 1 });
      throw cause;
    });
}

export class PasswordPolicy {
  validate(password: string): void {
    if (!PASSWORD_RULES.every((rule) => rule.satisfiedBy(password))) {
      throw new DomainError('PASSWORD_POLICY_REJECTED');
    }
  }

  async hash(password: string): Promise<string> {
    this.validate(password);
    const salt = randomBytes(16);
    const result = await scrypt(password, salt, 64);
    return `scrypt$${VERSION}$${COST}$${BLOCK}$${PARALLEL}$${salt.toString('base64url')}$${result.toString('base64url')}`;
  }

  async verify(password: string, encoded: string | null): Promise<boolean> {
    if (encoded === null) {
      await scrypt(password, Buffer.alloc(16), 64);
      return false;
    }
    const [algorithm, version, costValue, blockValue, parallelValue, saltValue, hashValue] = encoded.split('$');
    if (algorithm !== 'scrypt' || version !== VERSION || Number(costValue) !== COST || Number(blockValue) !== BLOCK || Number(parallelValue) !== PARALLEL || !saltValue || !hashValue) return false;
    const expected = Buffer.from(hashValue, 'base64url');
    const actual = await scrypt(password, Buffer.from(saltValue, 'base64url'), expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
