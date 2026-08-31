import { createHmac, timingSafeEqual } from 'node:crypto';
import { InvitationCode } from '../../domain/model/InvitationCode';
import type { InvitationDigest, InvitationHashPort } from '../../application/port/InvitationSecurity';

export interface InvitationKey {
  readonly version: string;
  readonly value: string;
}
export interface InvitationKeyring {
  readonly current: InvitationKey;
  readonly previous: readonly InvitationKey[];
}
export class InvitationHasher implements InvitationHashPort {
  private readonly keys: InvitationKeyring;
  constructor(source: string) {
    this.keys = parseKeyring(source);
  }

  current(code: InvitationCode): InvitationDigest {
    return digest(this.keys.current, code);
  }
  candidates(code: InvitationCode): readonly InvitationDigest[] {
    return Object.freeze([this.keys.current, ...this.keys.previous].map((key) => digest(key, code)));
  }
  matches(code: InvitationCode, expected: Buffer, version: string): boolean {
    const candidate = this.candidates(code).find((value) => value.version === version)?.hash;
    return candidate !== undefined && candidate.length === expected.length && timingSafeEqual(candidate, expected);
  }
  recipient(value: string): Buffer {
    return recipient(this.keys.current, value);
  }
  matchesRecipient(value: string, expected: Buffer): boolean {
    return [this.keys.current, ...this.keys.previous].some((key) => {
      const actual = recipient(key, value);
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    });
  }
  versions(): readonly string[] {
    return Object.freeze([this.keys.current.version, ...this.keys.previous.map(({ version }) => version)]);
  }
}

function parseKeyring(source: string): InvitationKeyring {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error('INVITATION_KEYRING_INVALID');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVITATION_KEYRING_INVALID');
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(',') !== 'current,previous' || !Array.isArray(record.previous) || record.previous.length > 2) {
    throw new Error('INVITATION_KEYRING_INVALID');
  }
  const current = parseKey(record.current);
  const previous = record.previous.map(parseKey);
  const versions = [current, ...previous].map(({ version }) => version);
  if (new Set(versions).size !== versions.length) throw new Error('INVITATION_KEYRING_INVALID');
  return Object.freeze({ current, previous: Object.freeze(previous) });
}

function parseKey(value: unknown): InvitationKey {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVITATION_KEYRING_INVALID');
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(',') !== 'value,version' || typeof record.version !== 'string' || !/^[A-Za-z0-9.-]{1,128}$/.test(record.version) || typeof record.value !== 'string' || Buffer.byteLength(record.value) < 32)
    throw new Error('INVITATION_KEYRING_INVALID');
  return Object.freeze({ version: record.version, value: record.value });
}

function digest(key: InvitationKey, code: InvitationCode): InvitationDigest {
  return Object.freeze({ version: key.version, hash: code.hmac(key.value) });
}

function recipient(key: InvitationKey, value: string): Buffer {
  return createHmac('sha256', key.value).update(value.trim().toLowerCase()).digest();
}
