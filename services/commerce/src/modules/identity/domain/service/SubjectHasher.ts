import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IdentityProviderType } from '@shop/config/server';

export interface SubjectKey {
  readonly version: string;
  readonly value: string;
}
export class SubjectHasher {
  constructor(
    private readonly current: SubjectKey,
    private readonly previous?: SubjectKey
  ) {
    for (const key of [current, previous])
      if (key && (key.value.length < 32 || !/^[A-Za-z0-9.:/-]{1,128}$/.test(key.version))) {
        throw new Error('SUBJECT_KEY_INVALID');
      }
  }
  hash(value: Readonly<{ provider: IdentityProviderType; instance: string; tenant: string; subject: string }>, version = this.current.version): Buffer {
    const key = [this.current, this.previous].find((candidate) => candidate?.version === version);
    if (!key) throw new Error('SUBJECT_KEY_VERSION_INVALID');
    const canonical = [value.provider, value.instance, value.tenant.normalize('NFKC').trim(), value.subject.normalize('NFKC').trim()].join('\u001f');
    return createHmac('sha256', key.value).update(canonical).digest();
  }
  matches(expected: Buffer, value: Parameters<SubjectHasher['hash']>[0], version: string): boolean {
    const actual = this.hash(value, version);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
  version(): string {
    return this.current.version;
  }
}
