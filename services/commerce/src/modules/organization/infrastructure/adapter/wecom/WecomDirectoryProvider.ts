import { DomainError } from '../../../../../foundation/domain/DomainError';
import { createDecipheriv, createHash, timingSafeEqual } from 'node:crypto';
import { WECOM_PROVIDER_CONFIGURATION } from '@shop/config/server';
import type { DirectoryProvider, DirectoryPage, ExternalDirectorySubject } from '../../../application/port/DirectoryProvider';
import type { DirectoryConnection } from '../../../domain/model/DirectoryConnection';
import type { WecomDirectoryClient, WecomDirectoryPayload } from './WecomDirectoryClient';

export class WecomDirectoryProvider implements DirectoryProvider {
  readonly type: 'wecomcorp' | 'wecomsuite';
  constructor(
    type: 'wecomcorp' | 'wecomsuite',
    private readonly client: WecomDirectoryClient
  ) {
    this.type = type;
    Object.freeze(this);
  }
  async changes(connection: DirectoryConnection, cursor: string | null, signal: AbortSignal): Promise<DirectoryPage> {
    const payload = await this.client.page(connection, cursor, signal);
    const subjects = this.map(payload);
    const next = payload.complete ? null : Buffer.from(JSON.stringify({ offset: payload.offset + WECOM_PROVIDER_CONFIGURATION.pageSize })).toString('base64url');
    const digest = createHash('sha256').update(`${connection.id}:${payload.version}:${payload.offset}`).digest('hex');
    return Object.freeze({ eventid: `page:${digest}`, version: payload.version, tenant: payload.tenant, subjects, cursor: next, complete: payload.complete });
  }
  event(_connection: DirectoryConnection, payload: string): DirectoryPage {
    const type = tag(payload, 'ChangeType');
    const timestamp = integer(tag(payload, 'CreateTime'));
    const external = tag(payload, type.endsWith('party') ? 'Id' : 'UserID');
    const removed = type === 'delete_user' || type === 'delete_party';
    const subjecttype = type.endsWith('party') ? 'department' : 'user';
    if (!['create_user', 'update_user', 'delete_user', 'create_party', 'update_party', 'delete_party'].includes(type)) throw new Error('DIRECTORY_EVENT_UNSUPPORTED');
    const departments = subjecttype === 'user' ? optionalTag(payload, 'Department').split(/[|,]/).filter(Boolean) : [];
    const parent = subjecttype === 'department' ? optionalTag(payload, 'ParentId') || null : null;
    const name = optionalTag(payload, 'Name') || 'Directory subject';
    const subject: ExternalDirectorySubject = Object.freeze({
      externalid: external,
      type: subjecttype,
      name,
      parentid: parent,
      departments: Object.freeze(departments),
      status: removed ? 'inactive' : 'active',
      version: timestamp,
      explicitdeparture: removed,
    });
    const eventid = optionalTag(payload, 'MsgId') || createHash('sha256').update(payload).digest('hex');
    return Object.freeze({ eventid, version: timestamp, tenant: tag(payload, 'ToUserName'), subjects: Object.freeze([subject]), cursor: null, complete: true });
  }
  async verify(connection: DirectoryConnection, body: string, _headers: Readonly<Record<string, string>>, query: Readonly<Record<string, string | readonly string[]>>) {
    const signature = scalar(query.msg_signature);
    const timestamp = scalar(query.timestamp);
    const nonce = scalar(query.nonce);
    const encrypted = tag(body, 'Encrypt');
    if (!signature || !/^[0-9a-f]{40}$/i.test(signature) || !timestamp || !/^\d{10}$/.test(timestamp) || !nonce || nonce.length > 128) throw new DomainError('PROVIDER_SIGNATURE_INVALID');
    if (Math.abs(Date.now() - Number(timestamp) * 1000) > 300_000) throw new DomainError('PROVIDER_REPLAY_DETECTED');
    const material = await this.client.webhookMaterial(connection);
    const expected = createHash('sha1').update([material.token, timestamp, nonce, encrypted].sort().join('')).digest();
    const actual = Buffer.from(signature, 'hex');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new DomainError('PROVIDER_SIGNATURE_INVALID');
    const payload = decrypt(encrypted, material.aeskey, material.recipient);
    const version = integer(tag(payload, 'CreateTime'));
    const eventid = optionalTag(payload, 'MsgId') || createHash('sha256').update(payload).digest('hex');
    return Object.freeze({ eventid, version, payload });
  }
  private map(payload: WecomDirectoryPayload): readonly ExternalDirectorySubject[] {
    const departments = payload.departments.map((value) => department(value, payload.version));
    const users = payload.users.map((value) => user(value, payload.version));
    return Object.freeze([...departments, ...users]);
  }
}
function department(value: Record<string, unknown>, fallback: number): ExternalDirectorySubject {
  const external = text(value.id ?? value.departmentid, 128);
  const parent = value.parentid === undefined || Number(value.parentid) === 0 ? null : text(value.parentid, 128);
  return Object.freeze({ externalid: external, type: 'department', name: text(value.name, 128), parentid: parent, departments: Object.freeze([]), status: 'active', version: fallback, explicitdeparture: false });
}
function user(value: Record<string, unknown>, fallback: number): ExternalDirectorySubject {
  const status = Number(value.status ?? 1) === 1 ? 'active' : 'inactive';
  const departmentids = Array.isArray(value.department) ? value.department.map((item) => text(item, 128)) : [];
  return Object.freeze({
    externalid: text(value.userid ?? value.open_userid, 512),
    type: 'user',
    name: text(value.name ?? 'Directory subject', 128),
    parentid: null,
    departments: Object.freeze(departmentids),
    status,
    version: integer(value.version ?? fallback),
    explicitdeparture: status === 'inactive',
  });
}
function text(value: unknown, maximum: number): string {
  const result = String(value ?? '')
    .normalize('NFKC')
    .trim();
  if (!result || result.length > maximum || /[\u0000-\u001f]/.test(result)) throw new Error('DIRECTORY_PROVIDER_RESPONSE_INVALID');
  return result;
}
function integer(value: unknown): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) throw new Error('DIRECTORY_PROVIDER_RESPONSE_INVALID');
  return result;
}
function scalar(value: string | readonly string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
function tag(xml: string, name: string): string {
  const value = optionalTag(xml, name);
  if (!value) throw new Error('DIRECTORY_PROVIDER_RESPONSE_INVALID');
  return value;
}
function optionalTag(xml: string, name: string): string {
  if (xml.length > 1_048_576 || !/^[A-Za-z][A-Za-z0-9]*$/.test(name)) throw new Error('DIRECTORY_PROVIDER_RESPONSE_INVALID');
  const match = new RegExp(`<${name}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`, 'i').exec(xml);
  return match?.[1]?.trim() ?? '';
}
function decrypt(value: string, keytext: string, recipient: string): string {
  let encrypted: Buffer, key: Buffer;
  try {
    encrypted = Buffer.from(value, 'base64');
    key = Buffer.from(`${keytext}=`, 'base64');
  } catch {
    throw new DomainError('PROVIDER_SIGNATURE_INVALID');
  }
  if (key.length !== 32 || encrypted.length === 0 || encrypted.length % 16 !== 0) throw new DomainError('PROVIDER_SIGNATURE_INVALID');
  const decipher = createDecipheriv('aes-256-cbc', key, key.subarray(0, 16));
  decipher.setAutoPadding(false);
  const padded = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  const pad = padded.at(-1) ?? 0;
  if (pad < 1 || pad > 32 || padded.subarray(padded.length - pad).some((byte) => byte !== pad)) throw new DomainError('PROVIDER_SIGNATURE_INVALID');
  const plain = padded.subarray(0, padded.length - pad);
  if (plain.length < 20) throw new DomainError('PROVIDER_SIGNATURE_INVALID');
  const length = plain.readUInt32BE(16);
  if (length < 1 || 20 + length > plain.length) throw new DomainError('PROVIDER_SIGNATURE_INVALID');
  const payload = plain.subarray(20, 20 + length).toString('utf8');
  const target = plain.subarray(20 + length).toString('utf8');
  if (target !== recipient) throw new DomainError('PROVIDER_SIGNATURE_INVALID');
  return payload;
}
