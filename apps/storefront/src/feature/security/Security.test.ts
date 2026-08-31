import { describe, expect, it } from 'vitest';
import { mapSecurity } from './infrastructure/SecurityMapper';

describe('security mapping', () => {
  it('keeps the current device and credential posture', () => {
    const value = mapSecurity({ session: 'session:1', assurance: { level: 2 }, security: { hasLocalCredential: true, phoneMasked: '138****0000', passwordChangedAt: null } }, [
      { id: 'session:1', client: 'storefront', deviceLabel: 'Safari', userAgent: 'Safari', assurance: 2, createdAt: '2026-08-31T00:00:00Z', lastSeenAt: '2026-08-31T00:00:00Z', expiresAt: '2026-09-01T00:00:00Z', current: true },
    ]);
    expect(value.sessions[0]?.current).toBe(true);
    expect(value.phoneMasked).toBe('138****0000');
  });
});
