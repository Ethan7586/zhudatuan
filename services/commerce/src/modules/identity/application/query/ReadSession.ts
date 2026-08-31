import type { OperationAction } from '../../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { IdentityMemberPort } from '../../../member/public';
import type { SessionCookiePort } from '../port/SessionCookiePort';
import type { CredentialRepository } from '../port/CredentialRepository';

export class ReadSession {
  constructor(
    private readonly members: IdentityMemberPort,
    private readonly kms: KmsClient,
    private readonly cookies: SessionCookiePort,
    private readonly credentials: CredentialRepository
  ) {}
  action(): OperationAction {
    return async (request, database) => {
      const access = requireAccess(request);
      const permissions = [...access.membership.permissions.allows].filter((permission) => !access.membership.permissions.denies.has(permission)).sort();
      const scopes = [...new Map(access.membership.scopes.filter((grant) => grant.effect === 'allow').map((grant) => [grant.scope.id, grant.scope] as const)).values()];
      const [credential, member] = await Promise.all([this.credentials.security(database, access.actor.id), this.members.securityProfile(database, access.actor.id)]);
      const mobile = member.mobileCiphertext === null ? null : await this.kms.decrypt('pii', 'identity/mobile', member.mobileCiphertext, { principal: access.actor.id });
      const csrf = this.cookies.read(request.input.headers.cookie, `__Host-${access.actor.target}-csrf`);
      const assurance = { level: access.assurance.level, ...(access.assurance.verified === undefined ? {} : { verified: access.assurance.verified.toISOString() }) };
      return {
        status: 200,
        body: {
          actor: access.actor.id,
          session: access.actor.session,
          membership: access.membership.id,
          scope: access.scope,
          scopes,
          accessVersion: access.accessVersion,
          permissions,
          capabilities: [...access.capabilities],
          assurance,
          target: access.actor.target,
          security: { hasLocalCredential: credential.hasLocalCredential, phoneMasked: mobile === null ? null : mask(mobile), passwordChangedAt: credential.passwordChangedAt?.toISOString() ?? null },
          syncedAt: new Date().toISOString(),
          ...(csrf === undefined ? {} : { csrf }),
        },
      };
    };
  }
}
function mask(value: string): string {
  return `${value.slice(0, 3)}****${value.slice(-4)}`;
}
