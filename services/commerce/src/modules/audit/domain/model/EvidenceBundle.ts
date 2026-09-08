import { canonical, digest, immutable } from './AuditRecord';

export interface EvidenceEntry {
  readonly kind: 'command' | 'access';
  readonly id: string;
  readonly recordHash: string;
}

interface EvidenceRow extends Readonly<Record<string, unknown>> {
  readonly kind: 'command' | 'access';
  readonly id: string;
  readonly record_hash: string;
  readonly previous_hash: string | null;
}

export class EvidenceBundle {
  readonly format = 'shop.audit.evidence.v2' as const;
  readonly rows: readonly EvidenceRow[];
  readonly entries: readonly EvidenceEntry[];
  readonly indexHash: string;
  readonly plaintext: string;
  readonly plaintextHash: string;

  constructor(
    readonly scope: string,
    readonly start: string,
    readonly end: string,
    readonly firstHash: string,
    readonly lastHash: string,
    rows: readonly Readonly<Record<string, unknown>>[]
  ) {
    if (!scope || !time(start) || !time(end) || Date.parse(start) > Date.parse(end) || !hash(firstHash) || !hash(lastHash) || rows.length === 0) {
      throw new Error('AUDIT_EVIDENCE_BUNDLE_INVALID');
    }
    this.rows = immutable(rows) as readonly EvidenceRow[];
    this.entries = Object.freeze(this.rows.map((row, index) => entry(row, index, this.rows)));
    if (this.entries[0]?.recordHash !== firstHash || this.entries.at(-1)?.recordHash !== lastHash) throw new Error('AUDIT_EVIDENCE_BOUNDARY_MISMATCH');
    this.indexHash = digest(canonical(this.entries));
    this.plaintext = canonical({ format: this.format, scope, start, end, firstHash, lastHash, count: this.rows.length, rows: this.rows });
    this.plaintextHash = digest(this.plaintext);
    Object.freeze(this);
  }

  static restore(plaintext: string): EvidenceBundle {
    const value = JSON.parse(plaintext) as Readonly<Record<string, unknown>>;
    if (
      value.format !== 'shop.audit.evidence.v2' ||
      typeof value.scope !== 'string' ||
      typeof value.start !== 'string' ||
      typeof value.end !== 'string' ||
      typeof value.firstHash !== 'string' ||
      typeof value.lastHash !== 'string' ||
      !Array.isArray(value.rows) ||
      value.count !== value.rows.length
    ) {
      throw new Error('AUDIT_EVIDENCE_BUNDLE_INVALID');
    }
    return new EvidenceBundle(value.scope, value.start, value.end, value.firstHash, value.lastHash, value.rows as readonly Readonly<Record<string, unknown>>[]);
  }
}

function entry(row: EvidenceRow, index: number, rows: readonly EvidenceRow[]): EvidenceEntry {
  if (!['command', 'access'].includes(row.kind) || typeof row.id !== 'string' || !hash(row.record_hash) || (row.previous_hash !== null && !hash(row.previous_hash))) {
    throw new Error('AUDIT_EVIDENCE_ROW_INVALID');
  }
  if (index > 0 && row.previous_hash !== rows[index - 1]?.record_hash) throw new Error('AUDIT_EVIDENCE_CHAIN_BROKEN');
  return Object.freeze({ kind: row.kind, id: row.id, recordHash: row.record_hash });
}

function hash(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}
function time(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}
