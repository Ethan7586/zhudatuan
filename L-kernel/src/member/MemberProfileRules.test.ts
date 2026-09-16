import { describe, expect, it } from 'vitest';
import { validateMemberCustomFieldValue, validateMemberProfileConfig } from './MemberProfileRules';

describe('shared member profile rules', () => {
  it('accepts supported field configurations', () => {
    const config = { fields: [
      { type: 'text', options: [] },
      { type: 'select', options: ['A'] },
      { type: 'multiselect', options: ['A', 'B'] },
    ] };
    expect(() => validateMemberProfileConfig(config)).not.toThrow();
  });

  it('keeps the existing field errors and values', () => {
    expect(() => validateMemberProfileConfig({ fields: [{ type: 'select', options: [] }] })).toThrow('CUSTOM_FIELD_OPTIONS_INVALID');
    expect(() => validateMemberCustomFieldValue(undefined, 'A')).toThrow('CUSTOM_PROFILE_CONFIGURATION_STALE');
    expect(() => validateMemberCustomFieldValue({ type: 'select', options: ['A'] }, 'B')).toThrow('CUSTOM_FIELD_VALUE_INVALID');
    expect(() => validateMemberCustomFieldValue({ type: 'multiselect', options: ['A', 'B'] }, ['A', 'B'])).not.toThrow();
  });
});
