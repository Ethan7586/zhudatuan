import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { SecretMaterial } from '@shop/contract';
import type { SecretStore } from '../../../platform/secret/SecretStore';
import { LifecyclePolicy } from '../domain/policy/LifecyclePolicy';
import { DirectoryPolicy } from '../domain/policy/DirectoryPolicy';
import { DirectoryConnection } from '../domain/model/DirectoryConnection';
import { WecomDirectoryClient } from '../infrastructure/adapter/wecom/WecomDirectoryClient';
import { WecomDirectoryProvider } from '../infrastructure/adapter/wecom/WecomDirectoryProvider';
import { WecomDirectoryMapper } from '../infrastructure/adapter/wecom/WecomDirectoryMapper';
import { SubjectHasher } from '../../identity/domain/service/SubjectHasher';
import { DirectoryReconciler } from '../application/service/DirectoryReconciler';
import type { DirectoryRepository, StagedSubject } from '../application/port/DirectoryRepository';
import type { MembershipLifecycle } from '../application/service/MembershipLifecycle';

const connection = new DirectoryConnection({
  id: '11111111-1111-4111-8111-111111111111',
  tenantid: '22222222-2222-4222-8222-222222222222',
  organizationid: 'enterprise:root',
  providerid: '33333333-3333-4333-8333-333333333333',
  providertype: 'wecomcorp',
  secretref: 'identity/wecom/corp',
  cursor: null,
  successfulversion: 0,
  status: 'enabled',
  version: 0,
});

describe('Directory policies', () => {
  it('covers create update freeze restore conflict noop and grace', () => {
    const policy = new LifecyclePolicy();
    expect(policy.decide(null, { status: 'active', sourceversion: 1, explicitdeparture: false })).toBe('create');
    expect(policy.decide({ status: 'active', sourceversion: 1, missingcount: 0, membership: 'm' }, { status: 'active', sourceversion: 2, explicitdeparture: false })).toBe('update');
    expect(policy.decide({ status: 'active', sourceversion: 2, missingcount: 0, membership: 'm' }, { status: 'inactive', sourceversion: 3, explicitdeparture: false })).toBe('noop');
    expect(policy.decide({ status: 'active', sourceversion: 2, missingcount: 1, membership: 'm' }, { status: 'inactive', sourceversion: 3, explicitdeparture: false })).toBe('freeze');
    expect(policy.decide({ status: 'inactive', sourceversion: 3, missingcount: 0, membership: 'm' }, { status: 'active', sourceversion: 4, explicitdeparture: false })).toBe('restore');
    expect(policy.decide(null, { status: 'conflict', sourceversion: 1, explicitdeparture: false })).toBe('conflict');
    expect(policy.decide({ status: 'active', sourceversion: 4, missingcount: 0, membership: 'm' }, { status: 'active', sourceversion: 3, explicitdeparture: false })).toBe('noop');
  });
  it('rejects stale pages and hierarchy cycles', () => {
    const policy = new DirectoryPolicy();
    const base = { eventid: 'e', tenant: 'corp', cursor: null, complete: true };
    expect(() => policy.validate({ ...base, version: 1, subjects: [] }, 2)).toThrow('DIRECTORY_SYNC_STALE');
    const department = (externalid: string, parentid: string) => ({ externalid, type: 'department' as const, name: externalid, parentid, departments: [], status: 'active' as const, version: 2, explicitdeparture: false });
    expect(() => policy.validate({ ...base, version: 2, subjects: [department('a', 'b'), department('b', 'a')] }, 1)).toThrow('DIRECTORY_HIERARCHY_CYCLE');
  });
  it('uses the same normalized identity hash for directory users', () => {
    const key = 'directory-test-key-with-at-least-thirty-two-bytes';
    const mapper = new WecomDirectoryMapper(key);
    const mapped = mapper.map(connection, {
      eventid: 'e',
      version: 1,
      tenant: 'corp',
      cursor: null,
      complete: true,
      subjects: [{ externalid: ' User-1 ', type: 'user', name: 'N', parentid: null, departments: [], status: 'active', version: 1, explicitdeparture: false }],
    })[0]!;
    const expected = new SubjectHasher({ version: 'current', value: key }).hash({ provider: 'wecomcorp', instance: connection.providerid, tenant: 'corp', subject: 'User-1' });
    expect(mapped.hash.equals(expected)).toBe(true);
    expect(JSON.stringify(mapped)).not.toContain('User-1');
  });
  it('previews the complete batch diff without changing directory or membership state', async () => {
    const subjects = ['create', 'update', 'freeze', 'restore'].map(staged);
    const current = new Map([
      [subjects[1]!.hash.toString('hex'), { id: 'old:update', status: 'active', sourceversion: 1, missingcount: 0, membership: 'membership:update' }],
      [subjects[2]!.hash.toString('hex'), { id: 'old:freeze', status: 'active', sourceversion: 1, missingcount: 1, membership: 'membership:freeze' }],
      [subjects[3]!.hash.toString('hex'), { id: 'old:restore', status: 'inactive', sourceversion: 1, missingcount: 0, membership: 'membership:restore' }],
    ]);
    const repository = { current: vi.fn(async () => current), apply: vi.fn() } as unknown as DirectoryRepository;
    const lifecycle = { apply: vi.fn() } as unknown as MembershipLifecycle;
    const result = await new DirectoryReconciler(repository, lifecycle).preview({} as never, connection, subjects);
    expect(result).toEqual({ read: 4, applied: 4, creates: 1, updates: 1, freezes: 1, restores: 1, conflicts: 0, ignored: 0 });
    expect(repository.apply).not.toHaveBeenCalled();
    expect(lifecycle.apply).not.toHaveBeenCalled();
  });
});

describe('WeCom directory webhook', () => {
  it('verifies SHA1, decrypts AES and maps an immediate departure', async () => {
    const token = 'callback-token';
    const key = randomBytes(32);
    const aeskey = key.toString('base64').replace(/=$/, '');
    const store: SecretStore = { resolve: async () => material(JSON.stringify({ clientid: 'agent', secret: 'a-secret-value-long-enough', tenant: 'corp', issuer: null, token, aeskey })) };
    const provider = new WecomDirectoryProvider('wecomcorp', new WecomDirectoryClient(store));
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = 'nonce';
    const xml = '<xml><ToUserName><![CDATA[corp]]></ToUserName><CreateTime>123</CreateTime><ChangeType><![CDATA[delete_user]]></ChangeType><UserID><![CDATA[user-1]]></UserID><MsgId>event-1</MsgId></xml>';
    const encrypted = encrypt(xml, key, 'corp');
    const body = `<xml><Encrypt><![CDATA[${encrypted}]]></Encrypt></xml>`;
    const signature = createHash('sha1').update([token, timestamp, nonce, encrypted].sort().join('')).digest('hex');
    const verified = await provider.verify(connection, body, {}, { msg_signature: signature, timestamp, nonce });
    expect(verified.payload).toBe(xml);
    expect(provider.event(connection, verified.payload).subjects[0]).toMatchObject({ externalid: 'user-1', status: 'inactive', explicitdeparture: true });
  });
});

function material(value: string): SecretMaterial {
  return Object.freeze({
    version: '1',
    expiresAt: null,
    reveal: () => value,
    toString: () => {
      throw new Error('forbidden');
    },
    toJSON: () => {
      throw new Error('forbidden');
    },
    valueOf: () => {
      throw new Error('forbidden');
    },
    [Symbol.toPrimitive]: () => {
      throw new Error('forbidden');
    },
  });
}
function staged(kind: string, index: number): StagedSubject {
  return Object.freeze({
    id: `subject:${kind}`,
    hash: Buffer.alloc(32, index + 1),
    type: 'user',
    status: kind === 'freeze' ? 'inactive' : 'active',
    attributes: null,
    sourceversion: 2,
    organization: 'enterprise:root',
    parentorganization: null,
    displayname: kind,
    membership: null,
    explicitdeparture: false,
  });
}
function encrypt(xml: string, key: Buffer, recipient: string): string {
  const random = randomBytes(16);
  const body = Buffer.from(xml);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  const plain = Buffer.concat([random, length, body, Buffer.from(recipient)]);
  const pad = 32 - (plain.length % 32);
  const padded = Buffer.concat([plain, Buffer.alloc(pad, pad)]);
  const cipher = createCipheriv('aes-256-cbc', key, key.subarray(0, 16));
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(padded), cipher.final()]).toString('base64');
}
