import { describe, expect, it } from 'vitest';
import { AuditFieldPolicy } from './AuditFieldPolicy';

describe('AuditFieldPolicy', () => {
  it('requires fresh step-up assurance for evidence fields', () => {
    const policy = new AuditFieldPolicy();
    expect(policy.authorize(undefined, 2)).toBe('summary');
    expect(() => policy.authorize('evidence', 2)).toThrow('AUDIT_EVIDENCE_ASSURANCE_REQUIRED');
    expect(policy.authorize('evidence', 3)).toBe('evidence');
    expect(policy.fields('summary')).not.toContain('evidence');
    expect(policy.fields('evidence')).toContain('trace');
  });
});
