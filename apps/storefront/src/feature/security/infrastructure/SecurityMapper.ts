import type { DeviceSession } from '../model/DeviceSession';
import type { Security } from '../model/Security';

export type SessionView = Readonly<{ session: string; assurance: Readonly<{ level: number }>; security: Readonly<{ hasLocalCredential: boolean; phoneMasked: string | null; passwordChangedAt: string | null }> }>;
export type DeviceView = Readonly<{ id: string; client: 'console' | 'storefront'; deviceLabel: string; userAgent: string; assurance: number; createdAt: string; lastSeenAt: string; expiresAt: string; current: boolean }>;

export function mapSecurity(session: SessionView, devices: readonly DeviceView[]): Security {
  return Object.freeze({
    sessionId: session.session,
    assurance: session.assurance.level,
    hasLocalCredential: session.security.hasLocalCredential,
    phoneMasked: session.security.phoneMasked,
    passwordChangedAt: session.security.passwordChangedAt,
    sessions: Object.freeze(devices.map(mapDevice)),
  });
}

function mapDevice(value: DeviceView): DeviceSession {
  return Object.freeze({ ...value });
}
