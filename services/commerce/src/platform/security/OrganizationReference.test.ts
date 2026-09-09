import { describe, expect, it } from 'vitest';
import { isOrganizationReference } from './OrganizationReference';

describe('organization reference', () => {
  it('accepts canonical readable organization identifiers', () => {
    expect(isOrganizationReference('tenant-zhudatuan')).toBe(true);
    expect(isOrganizationReference('enterprise:zhudatuan')).toBe(true);
  });

  it('rejects legacy UUID and unsafe identifiers', () => {
    expect(isOrganizationReference('22222222-2222-4222-8222-222222222222')).toBe(false);
    expect(isOrganizationReference('tenant zhudatuan')).toBe(false);
  });
});
