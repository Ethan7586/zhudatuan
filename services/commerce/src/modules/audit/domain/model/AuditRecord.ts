import { createHash } from 'node:crypto';
import type { AuditWriteInput } from '../../../../foundation/application/AuditSink';

export class AuditRecord {
  readonly id: string;
  readonly beforeHash: string;
  readonly afterHash: string;
  readonly recordHash: string;

  constructor(
    id: string,
    readonly input: AuditWriteInput,
    readonly evidence: unknown,
    readonly previousHash: string | null,
    readonly recordedAt: string
  ) {
    if (!input.scope || !input.actor || !input.actorType || !input.action || !input.resourceType || !input.trace || Number.isNaN(Date.parse(recordedAt))) {
      throw new Error('AUDIT_RECORD_INVALID');
    }
    if (!/^audit:[0-9a-f-]{36}$/.test(id)) throw new Error('AUDIT_ID_INVALID');
    this.beforeHash = digest(canonical(input.before));
    this.afterHash = digest(canonical(input.after));
    this.id = id;
    this.recordHash = digest(canonical({ id: this.id, ...input, before: this.beforeHash, after: this.afterHash, evidence, previous: previousHash, recordedAt }));
    Object.freeze(this);
  }
}

export function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
