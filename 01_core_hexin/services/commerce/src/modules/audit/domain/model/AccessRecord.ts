import type { AuditAccessInput } from '../../../../foundation/application/AuditSink';
import { canonical, digest } from './AuditRecord';

export class AccessRecord {
  readonly id: string; readonly recordHash: string;
  constructor(id: string, readonly input: AuditAccessInput, readonly fields: unknown, readonly previousHash: string | null, readonly accessedAt: string) {
    if (!input.scope || !input.actor || !input.actorType || !input.resourceType || !input.resource || !input.purpose || !input.trace
      || Number.isNaN(Date.parse(accessedAt))) throw new Error('AUDIT_ACCESS_INVALID');
    if (!/^access:[0-9a-f-]{36}$/.test(id)) throw new Error('AUDIT_ACCESS_ID_INVALID');
    this.id = id;
    this.recordHash = digest(canonical({ id: this.id, ...input, fields, previous: previousHash, accessedAt }));
    Object.freeze(this);
  }
}
