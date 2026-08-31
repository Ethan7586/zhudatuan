import { createHmac } from 'node:crypto';
import type { DirectoryConnection } from '../../../domain/model/DirectoryConnection';
import type { DirectoryPage, ExternalDirectorySubject } from '../../../application/port/DirectoryProvider';
import type { StagedSubject } from '../../../application/port/DirectoryRepository';
import type { DirectoryMapper } from '../../../application/port/DirectoryMapper';

export class WecomDirectoryMapper implements DirectoryMapper {
  constructor(private readonly key: string) {
    if (key.length < 32) throw new Error('DIRECTORY_HASH_KEY_INVALID');
  }
  map(connection: DirectoryConnection, page: DirectoryPage): readonly StagedSubject[] {
    const departments = new Map(page.subjects.filter((item) => item.type === 'department').map((item) => [item.externalid, this.organization(connection, item.externalid)]));
    const source = ordered(page.subjects);
    return Object.freeze(source.map((item) => this.subject(connection, page.tenant, item, departments)));
  }
  private subject(connection: DirectoryConnection, tenant: string, item: ExternalDirectorySubject, departments: ReadonlyMap<string, string>): StagedSubject {
    const hash = this.hash(connection, item.type, tenant, item.externalid);
    const organization = item.type === 'department' ? this.organization(connection, item.externalid) : item.departments[0] === undefined ? connection.organizationid : this.organization(connection, item.departments[0]);
    const parent = item.type === 'department' ? (item.parentid === null ? connection.organizationid : (departments.get(item.parentid) ?? this.organization(connection, item.parentid))) : null;
    return Object.freeze({
      id: uuid(hash),
      hash,
      type: item.type,
      status: item.status,
      attributes: null,
      sourceversion: item.version,
      organization,
      parentorganization: parent,
      displayname: item.type === 'department' ? display(item.name, hash) : 'Directory subject',
      membership: null,
      explicitdeparture: item.explicitdeparture,
    });
  }
  private organization(connection: DirectoryConnection, external: string): string {
    return `directory:${this.hash(connection, 'department', 'organization', external).toString('hex').slice(0, 32)}`;
  }
  private hash(connection: DirectoryConnection, type: string, tenant: string, subject: string): Buffer {
    const normalized = type === 'user' ? subject : `department:${subject}`;
    const canonical = [connection.providertype, connection.providerid, tenant.normalize('NFKC').trim(), normalized.normalize('NFKC').trim()].join('\u001f');
    return createHmac('sha256', this.key).update(canonical).digest();
  }
}
function uuid(source: Buffer): string {
  const value = Buffer.from(source.subarray(0, 16));
  value[6] = (value[6]! & 0x0f) | 0x50;
  value[8] = (value[8]! & 0x3f) | 0x80;
  const hex = value.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function display(value: string, hash: Buffer): string {
  const normalized = value.normalize('NFKC').trim();
  return normalized && normalized.length <= 128 ? normalized : `Directory ${hash.toString('hex').slice(0, 8)}`;
}
function ordered(values: readonly ExternalDirectorySubject[]): readonly ExternalDirectorySubject[] {
  const departments = values.filter((item) => item.type === 'department');
  const depth = (item: ExternalDirectorySubject, seen = new Set<string>()): number => {
    if (item.parentid === null) return 0;
    if (seen.has(item.externalid)) throw new Error('DIRECTORY_HIERARCHY_CYCLE');
    const parent = departments.find((candidate) => candidate.externalid === item.parentid);
    return parent ? 1 + depth(parent, new Set([...seen, item.externalid])) : 1;
  };
  return [...departments].sort((left, right) => depth(left) - depth(right) || left.externalid.localeCompare(right.externalid)).concat(values.filter((item) => item.type === 'user'));
}
