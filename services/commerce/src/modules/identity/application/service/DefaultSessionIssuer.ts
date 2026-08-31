import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import type { CsrfProtector } from '../../../../foundation/security/CsrfProtector';
import type { SessionIssue, SessionIssuer, IssuedSession } from '../port/SessionIssuer';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { SessionCookiePort } from '../port/SessionCookiePort';
import { SessionPolicy } from '../../domain/policy/SessionPolicy';
import type { IdentityAccessPort } from '../../../access/public';
import { Session } from '../../domain/model/Session';
import type { SessionRepository } from '../port/SessionRepository';

export class DefaultSessionIssuer implements SessionIssuer {
  constructor(
    private readonly csrf: CsrfProtector,
    private readonly identitykey: string,
    private readonly access: IdentityAccessPort,
    private readonly cookies: SessionCookiePort,
    private readonly repository: SessionRepository,
    private readonly policy = new SessionPolicy()
  ) {
    if (identitykey.length < 32) throw new Error('SESSION_ISSUER_KEY_INVALID');
  }
  async issue(database: OperationDatabase, value: SessionIssue): Promise<IssuedSession> {
    const assurance = this.policy.assurance(value.assurance);
    const [membership, credentialVersion] = await Promise.all([this.access.session(database, value.membership, value.target), this.repository.credentialVersion(database, value.principal)]);
    const now = new Date();
    const token = randomBytes(48).toString('base64url');
    const session = new Session({
      id: `session:${randomUUID()}`,
      principal: value.principal,
      membership: value.membership,
      credentialVersion,
      accessVersion: membership.accessVersion,
      target: membership.client,
      assurance,
      expiresAt: new Date(now.getTime() + this.policy.ttlSeconds * 1000),
    });
    await this.repository.create(database, { session, tokenHash: hash(token), ipHash: this.digest(value.peer), userAgent: value.agent.slice(0, 512), deviceLabel: value.device.slice(0, 128), trace: value.trace });
    const expiresin = session.ttlSeconds(now);
    const csrf = this.csrf.issue(token, session.target, expiresin);
    return Object.freeze({ session: session.id, membership: session.membership, target: session.target, expiresin, headers: this.cookies.session(session.target, token, csrf, expiresin) });
  }
  private digest(value: string): string {
    return createHmac('sha256', this.identitykey).update(value).digest('hex');
  }
}
function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
