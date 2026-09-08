export type AuditDetail = 'summary' | 'evidence';

const SUMMARY_FIELDS = Object.freeze(['id', 'kind', 'scope', 'operation', 'subject', 'object', 'outcome', 'reason', 'beforeHash', 'afterHash', 'recordHash', 'occurredAt']);
const EVIDENCE_FIELDS = Object.freeze([...SUMMARY_FIELDS, 'actor', 'request', 'evidence', 'trace', 'previousHash']);

export class AuditFieldPolicy {
  authorize(requested: unknown, assurance: number): AuditDetail {
    const detail = requested === undefined || requested === null || requested === '' ? 'summary' : requested;
    if (detail !== 'summary' && detail !== 'evidence') throw new Error('AUDIT_DETAIL_INVALID');
    if (detail === 'evidence' && assurance < 3) throw new Error('AUDIT_EVIDENCE_ASSURANCE_REQUIRED');
    return detail;
  }

  fields(detail: AuditDetail): readonly string[] {
    return detail === 'evidence' ? EVIDENCE_FIELDS : SUMMARY_FIELDS;
  }
}
