import { storefrontClient } from '../../../shared/api/Client';
import type { StorefrontSession } from '../../../shared/api/Session';
import type { Security } from '../model/Security';
import { mapSecurity, type DeviceView } from './SecurityMapper';

export const SecurityGateway = Object.freeze({
  async read(session: StorefrontSession, signal?: AbortSignal): Promise<Security> {
    const context = storefrontClient.context(session, { signal, includeScope: false });
    const [security, devices] = await Promise.all([storefrontClient.commerce.identity.sessionRead({}, context), storefrontClient.commerce.identity.sessionsRead({ query: { limit: 100 } }, context)]);
    return mapSecurity(security, devices.items as readonly DeviceView[]);
  },
  async password(session: StorefrontSession, currentPassword: string, newPassword: string, key: string): Promise<void> {
    await storefrontClient.commerce.identity.passwordChange({ body: { currentPassword, newPassword } }, storefrontClient.context(session, { write: true, includeScope: false, expectedVersion: session.accessVersion, idempotencyKey: key }));
  },
  async challenge(session: StorefrontSession, mobile: string, key: string): Promise<string> {
    const value = await storefrontClient.commerce.identity.challengesCreate({ body: { purpose: 'phone_change', destination: mobile } }, storefrontClient.context(session, { write: true, includeScope: false, idempotencyKey: key }));
    return value.id;
  },
  async mobile(session: StorefrontSession, mobile: string, challenge: string, code: string, key: string): Promise<void> {
    await storefrontClient.commerce.identity.mobileManage({ body: { mobile, challenge, code } }, storefrontClient.context(session, { write: true, includeScope: false, expectedVersion: session.accessVersion, idempotencyKey: key }));
  },
  async revoke(session: StorefrontSession, target: string, key: string): Promise<readonly string[]> {
    const value = await storefrontClient.commerce.identity.sessionsRevoke(
      { path: { sessionid: target }, body: {} },
      storefrontClient.context(session, { write: true, includeScope: false, expectedVersion: session.accessVersion, idempotencyKey: key })
    );
    return value.sessions;
  },
});
