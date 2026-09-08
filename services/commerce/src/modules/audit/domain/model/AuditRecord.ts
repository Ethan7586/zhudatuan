import { createHash } from 'node:crypto';
import type { AuditWriteInput } from '../../../../platform/error/AuditEntry';

export class AuditRecord {
  readonly id: string;
  readonly input: AuditWriteInput;
  readonly evidence: unknown;
  readonly beforeHash: string;
  readonly afterHash: string;
  readonly recordHash: string;

  constructor(
    id: string,
    input: AuditWriteInput,
    evidence: unknown,
    readonly previousHash: string | null,
    readonly recordedAt: string
  ) {
    if (
      !input.scope ||
      !input.actor ||
      !input.actorType ||
      !input.request ||
      !input.operation ||
      !reference(input.subject, false) ||
      !reference(input.object, true) ||
      !['succeeded', 'rejected', 'failed'].includes(input.outcome) ||
      !input.reason ||
      !input.trace ||
      Number.isNaN(Date.parse(recordedAt))
    ) {
      throw new Error('AUDIT_RECORD_INVALID');
    }
    if (!/^audit:[0-9a-f-]{36}$/.test(id)) throw new Error('AUDIT_ID_INVALID');
    this.input = immutable(input) as AuditWriteInput;
    this.evidence = immutable(evidence);
    this.beforeHash = digest(canonical(this.input.before));
    this.afterHash = digest(canonical(this.input.after));
    this.id = id;
    this.recordHash = digest(canonical({ id: this.id, ...this.input, before: this.beforeHash, after: this.afterHash, evidence: this.evidence, previous: previousHash, recordedAt }));
    Object.freeze(this);
  }
}

function reference(value: Readonly<{ type: string; id: string | null }>, nullable: boolean): boolean {
  return /^[a-z][a-z0-9.]{0,63}$/.test(value.type) && (typeof value.id === 'string' ? value.id.length > 0 && value.id.length <= 512 : nullable);
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

export function immutable(value: unknown): unknown {
  if (Array.isArray(value)) return Object.freeze(value.map(immutable));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, immutable(item)])));
  return value;
}
