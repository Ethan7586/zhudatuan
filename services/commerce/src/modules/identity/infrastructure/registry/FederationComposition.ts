import type { KmsClient } from '../../../../pipeline/KmsPort';
import type { SecretStore } from '../../../../platform/secret/SecretStore';
import type { IdentityAccessPort } from '../../../access/public';
import type { IdentityMemberPort } from '../../../member/public';
import type { IdentityOrganizationPort } from '../../../organization/public';
import { FederateIdentity } from '../../application/service/FederateIdentity';
import { MembershipSelector } from '../../application/service/MembershipSelector';
import { ProviderResolver } from '../../application/service/ProviderResolver';
import type { ReturnTargetPort } from '../../application/port/ReturnTargetPort';
import type { SessionCookiePort } from '../../application/port/SessionCookiePort';
import type { SessionIssuer } from '../../application/port/SessionIssuer';
import type { FederationProtector } from '../../domain/service/FederationProtector';
import { Nonce } from '../../domain/service/Nonce';
import { SubjectHasher } from '../../domain/service/SubjectHasher';
import { PgFederationRepository } from '../persistence/PgFederationRepository';
import { PgIdentityLinkRepository } from '../persistence/PgIdentityLinkRepository';
import { PgLinkCaseRepository } from '../persistence/PgLinkCaseRepository';
import { PgMembershipSelection } from '../persistence/PgMembershipSelection';
import { PgProviderRepository } from '../persistence/PgProviderRepository';
import { ProviderHttpClient } from '../security/ProviderHttpClient';
import { identityProviderRegistry } from './IdentityProviderRegistry';

interface FederationDependencies {
  readonly secrets: SecretStore;
  readonly identityKey: string;
  readonly members: IdentityMemberPort;
  readonly access: IdentityAccessPort;
  readonly sessions: SessionIssuer;
  readonly protector: FederationProtector;
  readonly kms: KmsClient;
  readonly returns: ReturnTargetPort;
  readonly organizations: IdentityOrganizationPort;
  readonly cookies: SessionCookiePort;
}

export function composeFederation(input: FederationDependencies) {
  const client = new ProviderHttpClient(input.secrets);
  const providers = new PgProviderRepository(client, input.identityKey);
  const resolver = new ProviderResolver(providers, identityProviderRegistry(client, input.identityKey));
  const repository = new PgFederationRepository(input.members, input.access);
  const selector = new MembershipSelector(new PgMembershipSelection(), input.sessions, input.protector, input.access, input.members, repository, input.returns, input.cookies);
  const cases = new PgLinkCaseRepository();
  const links = new PgIdentityLinkRepository();
  const federation = new FederateIdentity(
    repository,
    cases,
    resolver,
    new SubjectHasher({ version: 'current', value: input.identityKey }),
    input.protector,
    new Nonce(),
    input.kms,
    input.sessions,
    input.returns,
    input.organizations,
    input.access,
    input.cookies,
    links
  );
  return Object.freeze({ providers, resolver, selector, cases, links, federation });
}
