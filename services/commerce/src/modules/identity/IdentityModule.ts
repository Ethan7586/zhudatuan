import { defineModule } from '../../bootstrap/DefinedModule';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations } from '../../foundation/application/ModuleOperations';
import { KMS_CLIENT } from '../../foundation/infrastructure/KmsClient';
import { IDENTITY_SECURITY_KEYS, SECRET_STORE } from '../../foundation/infrastructure/SecretStore';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { CSRF_PROTECTOR } from '../../foundation/security/CsrfProtector';
import { RISK_GATE } from '../../foundation/security/RiskGate';
import { ACTION_PROOF_PORT, IDENTITY_ACCESS_PORT, INVITATION_ACCESS_PORT } from '../access/public';
import { IDENTITY_MEMBER_PORT, INVITATION_MEMBER_PORT } from '../member/public';
import { IDENTITY_ORGANIZATION_PORT } from '../organization/public';
import { AuthenticationService } from './application/authentication/AuthenticationService';
import { FederationAuthenticator } from './application/authentication/FederationAuthenticator';
import { InvitationAuthenticator } from './application/authentication/InvitationAuthenticator';
import { OtpAuthenticator } from './application/authentication/OtpAuthenticator';
import { PasswordAuthenticator } from './application/authentication/PasswordAuthenticator';
import { CompleteEnrollment } from './application/command/CompleteEnrollment';
import { CompleteFederation } from './application/command/CompleteFederation';
import { CompleteSession } from './application/command/CompleteSession';
import { CreateChallenge } from './application/command/CreateChallenge';
import { CreateInvitation } from './application/command/CreateInvitation';
import { CreateIdentityLink } from './application/command/CreateIdentityLink';
import { ExchangeTicket } from './application/command/ExchangeTicket';
import { ManageCredential } from './application/command/ManageCredential';
import { ManageMember } from './application/command/ManageMember';
import { ManageIdentityProvider } from './application/command/ManageIdentityProvider';
import { ManageStepup } from './application/command/ManageStepup';
import { RevokeInvitation } from './application/command/RevokeInvitation';
import { RevokeIdentityLink } from './application/command/RevokeIdentityLink';
import { RevokeSession } from './application/command/RevokeSession';
import { SelectMembership } from './application/command/SelectMembership';
import { StartFederation } from './application/command/StartFederation';
import { TestIdentityProvider } from './application/command/TestIdentityProvider';
import { ReadEnrollment } from './application/query/ReadEnrollment';
import { ReadInvitations } from './application/query/ReadInvitations';
import { ReadIdentityLinks } from './application/query/ReadIdentityLinks';
import { ReadIdentityProviders } from './application/query/ReadIdentityProviders';
import { ReadMembershipSelection } from './application/query/ReadMembershipSelection';
import { ReadSession } from './application/query/ReadSession';
import { ReadSessions } from './application/query/ReadSessions';
import { ReadMemberships } from './application/query/ReadMemberships';
import { SwitchMembership } from './application/command/SwitchMembership';
import { ResolveInvitation } from './application/query/ResolveInvitation';
import { DefaultSessionIssuer } from './application/service/DefaultSessionIssuer';
import { FederationService } from './application/service/FederationService';
import { IdentityLinker } from './application/service/IdentityLinker';
import { MembershipSelector } from './application/service/MembershipSelector';
import { ProviderResolver } from './application/service/ProviderResolver';
import { PasswordPolicy } from './domain/policy/PasswordPolicy';
import { FederationProtector } from './domain/service/FederationProtector';
import { NonceService } from './domain/service/NonceService';
import { SubjectHasher } from './domain/service/SubjectHasher';
import { IdentityOperations, IDENTITY_BROKER_OPERATION_IDS, INVITATION_OPERATION_IDS, STANDARD_IDENTITY_OPERATION_IDS } from './IdentityOperations';
import { NOTIFICATION_IDENTITY_PORT } from './public/NotificationIdentityPort';
import { PgAuthTicket } from './infrastructure/PgAuthTicket';
import { PgInvitationRepository } from './infrastructure/persistence/PgInvitationRepository';
import { PgFederationRepository } from './infrastructure/persistence/PgFederationRepository';
import { PgIdentityLinkRepository } from './infrastructure/persistence/PgIdentityLinkRepository';
import { PgLinkCaseRepository } from './infrastructure/persistence/PgLinkCaseRepository';
import { PgProviderRepository } from './infrastructure/persistence/PgProviderRepository';
import { PgSessionRepository } from './infrastructure/persistence/PgSessionRepository';
import { PgAssuranceRepository } from './infrastructure/persistence/PgAssuranceRepository';
import { PgEnrollmentRepository } from './infrastructure/persistence/PgEnrollmentRepository';
import { PgIdentityEvent } from './infrastructure/persistence/PgIdentityEvent';
import { PgCredentialRepository } from './infrastructure/persistence/PgCredentialRepository';
import { PgRegistrationPolicyRepository } from './infrastructure/persistence/PgRegistrationPolicyRepository';
import { PgMembershipSelection } from './infrastructure/persistence/PgMembershipSelection';
import { PgNotificationIdentity } from './infrastructure/PgNotificationIdentity';
import { PgNavigationIdentity } from './infrastructure/PgNavigationIdentity';
import { AuthenticationRegistry } from './infrastructure/registry/AuthenticationRegistry';
import { identityProviderRegistry } from './infrastructure/registry/IdentityProviderRegistry';
import { RETURN_TARGETS } from './infrastructure/security/ReturnTargetCatalog';
import { ReturnTargetSigner } from './infrastructure/security/ReturnTargetSigner';
import { InvitationGenerator } from './infrastructure/security/InvitationGenerator';
import { InvitationHasher } from './infrastructure/security/InvitationHasher';
import { PgChallenge, PgLoginGuard } from './infrastructure/security/PgChallenge';
import { PgPreauthResolver } from './infrastructure/security/PgPreauthResolver';
import { PgInvitationRate } from './infrastructure/security/PgInvitationRate';
import { InvitationGuard } from './application/service/InvitationGuard';
import { TELEMETRY } from '../../foundation/telemetry/Telemetry';
import { ProviderHttpClient } from './infrastructure/security/ProviderHttpClient';
import { Manifest } from './Manifest';
import { NAVIGATION_IDENTITY_PORT } from './public/NavigationIdentityPort';
import { InvitationRedeemer } from './application/service/InvitationRedeemer';
import { SessionCookieAdapter } from './infrastructure/security/SessionCookie';
import { EnrollmentService } from './application/service/EnrollmentService';
import { InvitationFailure } from './application/service/InvitationFailure';
import { InvitationLookup } from './application/service/InvitationLookup';
import { PgStepupRequestRepository } from './infrastructure/persistence/PgStepupRequestRepository';
import { CurrentIdentityReadPort, IDENTITY_READ_PORT } from './public/IdentityReadPort';

export const IdentityModule = defineModule(Manifest, composeIdentity, [
  { token: NOTIFICATION_IDENTITY_PORT, value: new PgNotificationIdentity() },
  { token: NAVIGATION_IDENTITY_PORT, value: new PgNavigationIdentity() },
  { token: IDENTITY_READ_PORT, value: new CurrentIdentityReadPort() },
]);

function composeIdentity(context: ModuleContext): IdentityOperations {
  const pool = context.service(DATABASE_POOL);
  const audit = context.service(AUDIT_SINK);
  const keys = context.service(IDENTITY_SECURITY_KEYS);
  const kms = context.service(KMS_CLIENT);
  const csrf = context.service(CSRF_PROTECTOR);
  const telemetry = context.service(TELEMETRY);
  const repository = new PgInvitationRepository();
  const hasher = new InvitationHasher(keys.invitation);
  const returns = new ReturnTargetSigner(context.service(RETURN_TARGETS), keys.session);
  const invitationLookup = new InvitationLookup(repository, hasher);
  const cookies = new SessionCookieAdapter();
  const assurances = new PgAssuranceRepository();
  const events = new PgIdentityEvent();
  const invitationFailures = new InvitationFailure(events);
  const credentials = new PgCredentialRepository();
  const registrations = new PgRegistrationPolicyRepository();
  const protector = new FederationProtector(keys.session);
  const preauth = new PgPreauthResolver(pool, protector);
  const invitationGuard = new InvitationGuard(new PgInvitationRate(pool, telemetry), context.service(RISK_GATE), protector);
  const tickets = new PgAuthTicket(returns);
  const identityAccess = context.ports.get(IDENTITY_ACCESS_PORT);
  const members = context.ports.get(IDENTITY_MEMBER_PORT);
  const sessionRepository = new PgSessionRepository();
  const sessions = new DefaultSessionIssuer(csrf, keys.identity, identityAccess, cookies, sessionRepository);
  const challenges = new PgChallenge();
  const providerClient = new ProviderHttpClient(context.service(SECRET_STORE));
  const providers = new PgProviderRepository(providerClient, keys.identity);
  const resolver = new ProviderResolver(providers, identityProviderRegistry(providerClient, keys.identity));
  const invitationAccess = context.ports.get(INVITATION_ACCESS_PORT);
  const redeemer = new InvitationRedeemer(repository, invitationAccess, telemetry);
  const invited = context.ports.get(INVITATION_MEMBER_PORT);
  const federationRepository = new PgFederationRepository(members, identityAccess);
  const selector = new MembershipSelector(new PgMembershipSelection(), sessions, protector, returns, identityAccess, members, federationRepository, cookies);
  const linkcases = new PgLinkCaseRepository();
  const linkRepository = new PgIdentityLinkRepository();
  const federation = new FederationService(
    federationRepository,
    linkcases,
    resolver,
    new SubjectHasher({ version: 'current', value: keys.identity }),
    protector,
    new NonceService(),
    kms,
    sessions,
    returns,
    context.ports.get(IDENTITY_ORGANIZATION_PORT),
    identityAccess,
    cookies,
    linkRepository
  );
  const authentication = new AuthenticationService(
    new AuthenticationRegistry([
      new PasswordAuthenticator(keys.identity, sessions, returns, tickets, new PgLoginGuard(), identityAccess, members, selector, credentials),
      new OtpAuthenticator(keys.identity, keys.session, sessions, returns, tickets, challenges, identityAccess, members, selector, assurances),
      new InvitationAuthenticator(repository, invitationAccess, hasher, protector, sessions, returns, tickets, members, invited, kms, keys.session, invitationGuard, redeemer, cookies, challenges, invitationFailures, invitationLookup),
      new FederationAuthenticator(federation, returns),
    ])
  );
  const enrollments = new EnrollmentService(
    repository,
    invitationAccess,
    invited,
    sessions,
    returns,
    hasher,
    keys.identity,
    keys.session,
    tickets,
    challenges,
    linkcases,
    redeemer,
    cookies,
    telemetry,
    new PgEnrollmentRepository(),
    assurances,
    events,
    invitationFailures
  );
  const invitation = new ModuleOperations(
    'identity',
    pool,
    audit,
    {
      'identity.sessions.create': authentication.action(),
      'identity.sessions.complete': new CompleteSession(repository, redeemer, sessions, returns, keys.session, tickets, challenges, cookies, assurances, invitationFailures).action(),
      'identity.invitations.resolve': new ResolveInvitation(invitationLookup, invitationGuard, telemetry, registrations).action(),
      'identity.invitations.read': new ReadInvitations(repository).action(),
      'identity.invitations.create': new CreateInvitation(repository, invitationAccess, new InvitationGenerator(), hasher, registrations, events, telemetry).action(),
      'identity.invitations.revoke': new RevokeInvitation(repository, events).action(),
      'identity.enrollments.read': new ReadEnrollment(repository, registrations).action(),
      'identity.enrollments.complete': new CompleteEnrollment(kms, enrollments).lifecycle(),
    },
    INVITATION_OPERATION_IDS
  );
  const passwords = new PasswordPolicy();
  const credentialCommands = new ManageCredential(passwords, challenges, members, kms, context.service(RISK_GATE), keys.identity, keys.session, credentials, assurances, sessionRepository, events);
  const stepup = new ManageStepup(members, kms, challenges, keys.identity, keys.session, assurances, sessionRepository, events, context.ports.get(ACTION_PROOF_PORT), new PgStepupRequestRepository());
  const revocation = new RevokeSession(sessionRepository, cookies, events);
  const standard = new ModuleOperations(
    'identity',
    pool,
    audit,
    {
      'identity.tickets.exchange': new ExchangeTicket(tickets, csrf, cookies).action(),
      'identity.session.read': new ReadSession(members, kms, cookies, credentials).action(),
      'identity.session.delete': revocation.current(),
      'identity.sessions.read': new ReadSessions(sessionRepository).action(),
      'identity.sessions.revoke': revocation.selected(),
      'identity.memberships.read': new ReadMemberships(members, identityAccess, context.ports.get(IDENTITY_ORGANIZATION_PORT)).action(),
      'identity.memberships.switch': new SwitchMembership(members, identityAccess, sessions, sessionRepository, events).action(),
      'identity.challenges.create': new CreateChallenge(kms, context.service(RISK_GATE), challenges, keys.identity, keys.session, preauth, repository, hasher, events, credentials, members).lifecycle(),
      'identity.members.manage': new ManageMember(identityAccess, members).action(),
      'identity.password.change': credentialCommands.change(),
      'identity.password.verify': credentialCommands.verify(),
      'identity.password.reset': credentialCommands.reset(),
      'identity.mobile.manage': credentialCommands.mobile(),
      'identity.stepup.start': stepup.start(),
      'identity.stepup.complete': stepup.complete(),
    },
    STANDARD_IDENTITY_OPERATION_IDS
  );
  const linker = new IdentityLinker(linkRepository);
  const broker = new ModuleOperations(
    'identity',
    pool,
    audit,
    {
      'identity.providers.read': new ReadIdentityProviders(providers, returns).action(),
      'identity.federations.start': new StartFederation(federation).action(),
      'identity.federations.callback': new CompleteFederation(federation).action(),
      'identity.federations.selection.read': new ReadMembershipSelection(selector).action(),
      'identity.federations.complete': new SelectMembership(selector, cookies).action(),
      'identity.links.read': new ReadIdentityLinks(linker).action(),
      'identity.links.create': new CreateIdentityLink(federation).action(),
      'identity.links.revoke': new RevokeIdentityLink(linker).action(),
      'identity.providers.manage': new ManageIdentityProvider(providers, kms).action(),
      'identity.providers.test': new TestIdentityProvider(resolver).action(),
    },
    IDENTITY_BROKER_OPERATION_IDS
  );
  return new IdentityOperations(invitation, standard, broker);
}
