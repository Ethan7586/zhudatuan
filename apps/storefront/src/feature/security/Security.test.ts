import { describe, expect, it } from 'vitest';
import { mapSecurity } from './infrastructure/SecurityMapper';
import { assuranceName, presentDevice } from './viewmodel/DevicePresentation';

describe('security mapping', () => {
  it('keeps the current device and credential posture', () => {
    const value = mapSecurity({ session: 'session:1', assurance: { level: 2 }, security: { hasLocalCredential: true, phoneMasked: '138****0000', passwordChangedAt: null } }, [
      { id: 'session:1', client: 'storefront', deviceLabel: 'Safari', userAgent: 'Safari', assurance: 2, createdAt: '2026-08-31T00:00:00Z', lastSeenAt: '2026-08-31T00:00:00Z', expiresAt: '2026-09-01T00:00:00Z', current: true },
    ]);
    expect(value.sessions[0]?.current).toBe(true);
    expect(value.phoneMasked).toBe('138****0000');
  });

  it('presents a human-readable device name without exposing the internal device token', () => {
    const presented = presentDevice({
      id: 'session:1',
      client: 'storefront',
      deviceLabel: 'nTMSHFHeTza_ZEPCKkDHR0IaUA4Ljy29U9ElU',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',
      assurance: 2,
      createdAt: '2026-08-31T00:00:00Z',
      lastSeenAt: '2026-08-31T00:00:00Z',
      expiresAt: '2026-09-01T00:00:00Z',
      current: true,
    });
    expect(presented).toMatchObject({ name: 'macOS · Google Chrome', clientName: '消费者商城', verification: '已二次验证' });
    expect(JSON.stringify(presented)).not.toContain('nTMSHFHeTza');
    expect(assuranceName(3)).toBe('增强安全验证');
  });
});
