import { describe, expect, it } from 'vitest';
import { QualificationRule, changedRuleFields } from './QualificationRule';

describe('QualificationRule', () => {
  it('uses a canonical hash independent of object key insertion order', () => {
    const left = new QualificationRule({ effect: 'allow', requiredTags: ['employee'], nested: { beta: 2, alpha: 1 } });
    const right = new QualificationRule({ nested: { alpha: 1, beta: 2 }, requiredTags: ['employee'], effect: 'allow' });
    expect(left.hash).toBe(right.hash);
    expect(changedRuleFields(left.value, { ...right.value, requiredTags: ['manager'] })).toEqual(['requiredTags']);
  });

  it('rejects unsafe keys and invalid known values', () => {
    expect(() => new QualificationRule({ effect: 'unknown' })).toThrowError(expect.objectContaining({ code: 'VALIDATION_FAILED' }));
    expect(() => new QualificationRule({ requiredTags: ['employee', 'employee'] })).toThrowError(expect.objectContaining({ code: 'VALIDATION_FAILED' }));
    expect(() => new QualificationRule(JSON.parse('{"__proto__":true}'))).toThrowError(expect.objectContaining({ code: 'VALIDATION_FAILED' }));
  });
});
