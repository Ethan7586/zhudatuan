import type { StorefrontClient } from '../../../shared/api/Client';
import type { StorefrontSession } from '../../../entity/session';
import type { Security } from '../model/Security';
import { mapSecurity, type DeviceView } from './SecurityMapper';

export class SecurityGateway {
  constructor(private readonly identity: StorefrontClient['commerce']['identity'], private readonly context: StorefrontClient['context']) {}
  async read(session: StorefrontSession, signal?: AbortSignal): Promise<Security> {
    const context = this.context(session, { signal, includeScope: false });
    const [security, devices] = await Promise.all([this.identity.sessionRead({}, context), this.identity.sessionsRead({ query: { limit: 100 } }, context)]);
    return mapSecurity(security, devices.items as readonly DeviceView[]);
  }
  async password(session: StorefrontSession, currentPassword: string, newPassword: string, key: string): Promise<void> {
    await this.identity.passwordChange({ body: { currentPassword, newPassword } }, this.context(session, { write: true, includeScope: false, expectedVersion: session.accessVersion, idempotencyKey: key }));
  }
  async challenge(session: StorefrontSession, mobile: string, key: string): Promise<string> {
    const value = await this.identity.mobileChallengesCreate({ body: { destination: mobile } }, this.context(session, { write: true, idempotencyKey: key }));
    return value.id;
  }
  async mobile(session: StorefrontSession, mobile: string, challenge: string, code: string, key: string): Promise<void> {
    await this.identity.mobileManage({ body: { mobile, challenge, code } }, this.context(session, { write: true, includeScope: false, expectedVersion: session.accessVersion, idempotencyKey: key }));
  }
  async revoke(session: StorefrontSession, target: string, key: string): Promise<readonly string[]> {
    const value = await this.identity.sessionsRevoke(
      { path: { sessionid: target }, body: {} },
      this.context(session, { write: true, includeScope: false, expectedVersion: session.accessVersion, idempotencyKey: key })
    );
    return value.sessions;
  }
}
