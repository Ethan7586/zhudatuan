import type { AuditAccessInput } from '../../../../foundation/domain/AuditEntry';
import { canonical, digest, immutable } from './AuditRecord';

export class AccessRecord {
  readonly id: string;
  readonly input: AuditAccessInput;
  readonly fields: unknown;
  readonly recordHash: string;
  constructor(
    id: string,
    input: AuditAccessInput,
    fields: unknown,
    readonly previousHash: string | null,
    readonly accessedAt: string
  ) {
    if (
      !input.scope ||
      !input.actor ||
      !input.actorType ||
      !input.request ||
      !input.operation ||
      !input.subject.type ||
      !input.subject.id ||
      !input.object.type ||
      !input.object.id ||
      !['succeeded', 'rejected', 'failed'].includes(input.outcome) ||
      !input.reason ||
      !input.trace ||
      Number.isNaN(Date.parse(accessedAt))
    )
      throw new Error('AUDIT_ACCESS_INVALID');
    if (!/^access:[0-9a-f-]{36}$/.test(id)) throw new Error('AUDIT_ACCESS_ID_INVALID');
    this.input = immutable(input) as AuditAccessInput;
    this.fields = immutable(fields);
    this.id = id;
    this.recordHash = digest(canonical({ id: this.id, ...this.input, fields: this.fields, previous: previousHash, accessedAt }));
    Object.freeze(this);
  }
}
