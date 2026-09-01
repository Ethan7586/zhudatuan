import { CurrentIdentityReadPort } from './infrastructure/persistence/CurrentIdentityReadPort';
import { PgPaymentIdentityPort } from './infrastructure/persistence/PgPaymentIdentityPort';

import { defineModule } from '../../bootstrap/DefinedModule';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';

import type { RegisteredOperationHandler } from '../../foundation/application/OperationHandler';
import { KMS_CLIENT } from '../../foundation/infrastructure/KmsClient';
import { IDENTITY_SECURITY_KEYS, SECRET_STORE } from '../../foundation/infrastructure/SecretStore';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { CSRF_PROTECTOR } from '../../foundation/security/CsrfProtector';
import { RISK_GATE } from '../../foundation/security/RiskGate';
import { ACTION_PROOF_PORT, IDENTITY_ACCESS_PORT, INVITATION_ACCESS_PORT } from '../access/public';
import { IDENTITY_MEMBER_PORT, INVITATION_MEMBER_PORT } from '../member/public';
import { IDENTITY_ORGANIZATION_PORT } from '../organization/public';
import { AuthenticationService } from './application/service/AuthenticationService';
import { InvitationAuthenticator } from './application/service/InvitationAuthenticator';
import { OtpAuthenticator } from './application/service/OtpAuthenticator';
import { PasswordAuthenticator } from './application/service/PasswordAuthenticator';
import { CompleteEnrollment } from './application/service/CompleteEnrollment';
import { CompleteFederation } from './application/service/CompleteFederation';
import { CompleteSession } from './application/service/CompleteSession';
import { CreateChallenge } from './application/service/CreateChallenge';
import { CreateInvitation } from './application/service/CreateInvitation';
import { CreateIdentityLink } from './application/service/CreateIdentityLink';
import { ExchangeTicket } from './application/service/ExchangeTicket';
import { ManageCredential } from './application/service/ManageCredential';
import { ManageMember } from './application/service/ManageMember';
import { ManageIdentityProvider } from './application/service/ManageIdentityProvider';
import { ManageStepup } from './application/service/ManageStepup';
import { RevokeInvitation } from './application/service/RevokeInvitation';
import { RevokeIdentityLink } from './application/service/RevokeIdentityLink';
import { RevokeSession } from './application/service/RevokeSession';
import { SelectMembership } from './application/service/SelectMembership';
import { StartFederation } from './application/service/StartFederation';
import { TestIdentityProvider } from './application/service/TestIdentityProvider';
import { ReadEnrollment } from './application/service/ReadEnrollment';
import { ReadInvitations } from './application/service/ReadInvitations';
import { ReadIdentityLinks } from './application/service/ReadIdentityLinks';
import { ReadIdentityProviders } from './application/service/ReadIdentityProviders';
import { ReadMembershipSelection } from './application/service/ReadMembershipSelection';
import { ReadSession } from './application/service/ReadSession';
import { ReadSessions } from './application/service/ReadSessions';
import { ReadMemberships } from './application/service/ReadMemberships';
import { SwitchMembership } from './application/service/SwitchMembership';
import { ResolveInvitation } from './application/service/ResolveInvitation';
import { DefaultSessionIssuer } from './application/service/DefaultSessionIssuer';
import { FederationService } from './application/service/FederationService';
import { IdentityLinker } from './application/service/IdentityLinker';
import { MembershipSelector } from './application/service/MembershipSelector';
import { ProviderResolver } from './application/service/ProviderResolver';
import { PasswordPolicy } from './domain/policy/PasswordPolicy';
import { FederationProtector } from './domain/service/FederationProtector';
import { NonceService } from './domain/service/NonceService';
import { SubjectHasher } from './domain/service/SubjectHasher';
import { NOTIFICATION_IDENTITY_PORT } from './public/NotificationIdentityPort';
import { PgAuthTicket } from './infrastructure/persistence/PgAuthTicket';
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
import { PgNotificationIdentity } from './infrastructure/persistence/PgNotificationIdentity';
import { PgNavigationIdentity } from './infrastructure/persistence/PgNavigationIdentity';
import { CredentialRegistry } from './infrastructure/registry/CredentialRegistry';
import { identityProviderRegistry } from './infrastructure/registry/IdentityProviderRegistry';
import { RETURN_TARGETS } from './infrastructure/security/ReturnTargetCatalog';
import { ReturnTargetSigner } from './infrastructure/security/ReturnTargetSigner';
import { InvitationGenerator } from './infrastructure/security/InvitationGenerator';
import { InvitationHasher } from './infrastructure/security/InvitationHasher';
import { PgChallenge, PgLoginGuard } from './infrastructure/persistence/PgChallenge';
import { PgPreauthResolver } from './infrastructure/security/PgPreauthResolver';
import { PgInvitationRate } from './infrastructure/persistence/PgInvitationRate';
import { PgTransactionManager } from '../../adapter/database/PgTransactionManager';
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
import { IDENTITY_READ_PORT } from './public/IdentityReadPort';
import { IDENTITY_READINESS_PORT } from './public/ReadinessPort';
import { PAYMENT_IDENTITY_PORT } from './public/PaymentIdentityPort';
import { PgIdentityReadiness } from './infrastructure/persistence/PgIdentityReadiness';
import { PgIdentityPrincipal } from './infrastructure/persistence/PgIdentityPrincipal';
import { PgIdentityRetention } from './infrastructure/persistence/PgIdentityRetention';
import { MEMBER_IMPORT_IDENTITY_PORT, RUNTIME_IDENTITY_PORT } from './public';
import { SessionsCreateHandler } from './application/handler/SessionsCreateHandler';
import { SessionsCompleteHandler } from './application/handler/SessionsCompleteHandler';
import { TicketsExchangeHandler } from './application/handler/TicketsExchangeHandler';
import { SessionReadHandler } from './application/handler/SessionReadHandler';
import { SessionDeleteHandler } from './application/handler/SessionDeleteHandler';
import { SessionsReadHandler } from './application/handler/SessionsReadHandler';
import { SessionsRevokeHandler } from './application/handler/SessionsRevokeHandler';
import { MembershipsReadHandler } from './application/handler/MembershipsReadHandler';
import { MembershipsSwitchHandler } from './application/handler/MembershipsSwitchHandler';
import { ChallengesCreateHandler } from './application/handler/ChallengesCreateHandler';
import { MobileChallengesCreateHandler } from './application/handler/MobileChallengesCreateHandler';
import { InvitationsResolveHandler } from './application/handler/InvitationsResolveHandler';
import { InvitationsReadHandler } from './application/handler/InvitationsReadHandler';
import { InvitationsCreateHandler } from './application/handler/InvitationsCreateHandler';
import { InvitationsRevokeHandler } from './application/handler/InvitationsRevokeHandler';
import { EnrollmentsReadHandler } from './application/handler/EnrollmentsReadHandler';
import { EnrollmentsCompleteHandler } from './application/handler/EnrollmentsCompleteHandler';
import { MembersManageHandler } from './application/handler/MembersManageHandler';
import { PasswordChangeHandler } from './application/handler/PasswordChangeHandler';
import { PasswordVerifyHandler } from './application/handler/PasswordVerifyHandler';
import { PasswordResetHandler } from './application/handler/PasswordResetHandler';
import { MobileManageHandler } from './application/handler/MobileManageHandler';
import { StepUpStartHandler } from './application/handler/StepUpStartHandler';
import { StepUpCompleteHandler } from './application/handler/StepUpCompleteHandler';
import { ProvidersReadHandler } from './application/handler/ProvidersReadHandler';
import { FederationStartHandler } from './application/handler/FederationStartHandler';
import { FederationCallbackHandler } from './application/handler/FederationCallbackHandler';
import { MembershipSelectionReadHandler } from './application/handler/MembershipSelectionReadHandler';
import { FederationCompleteHandler } from './application/handler/FederationCompleteHandler';
import { LinksReadHandler } from './application/handler/LinksReadHandler';
import { LinksCreateHandler } from './application/handler/LinksCreateHandler';
import { LinksRevokeHandler } from './application/handler/LinksRevokeHandler';
import { ProvidersManageHandler } from './application/handler/ProvidersManageHandler';
import { ProvidersTestHandler } from './application/handler/ProvidersTestHandler';
import { createJobs } from './interface/job/JobFactory';

export const IdentityModule = defineModule(Manifest, {
  jobs: createJobs,
  handlers: composeIdentity,
  ports: [
    { token: NOTIFICATION_IDENTITY_PORT, value: new PgNotificationIdentity() },
    { token: NAVIGATION_IDENTITY_PORT, value: new PgNavigationIdentity() },
    { token: IDENTITY_READ_PORT, value: new CurrentIdentityReadPort() },
    { token: IDENTITY_READINESS_PORT, value: new PgIdentityReadiness() },
    { token: PAYMENT_IDENTITY_PORT, value: new PgPaymentIdentityPort() },
  ],
  jobPorts: [
    { token: NOTIFICATION_IDENTITY_PORT, value: new PgNotificationIdentity() },
    { token: MEMBER_IMPORT_IDENTITY_PORT, value: new PgIdentityPrincipal() },
    { token: RUNTIME_IDENTITY_PORT, value: new PgIdentityRetention() },
  ],
});

function composeIdentity(context: ModuleContext): readonly RegisteredOperationHandler[] {
  const pool = context.service(DATABASE_POOL);
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
  const invitationGuard = new InvitationGuard(new PgInvitationRate(new PgTransactionManager(pool), telemetry), context.service(RISK_GATE), protector);
  const tickets = new PgAuthTicket();
  const identityAccess = context.ports.get(IDENTITY_ACCESS_PORT);
  const members = context.ports.get(IDENTITY_MEMBER_PORT);
  const sessionRepository = new PgSessionRepository();
  const sessions = new DefaultSessionIssuer(csrf, keys.identity, identityAccess, cookies, sessionRepository);
  const challenges = new PgChallenge();
  const challengeCommands = new CreateChallenge(kms, context.service(RISK_GATE), challenges, keys.identity, keys.session, preauth, repository, hasher, events, credentials, members);
  const providerClient = new ProviderHttpClient(context.service(SECRET_STORE));
  const providers = new PgProviderRepository(providerClient, keys.identity);
  const resolver = new ProviderResolver(providers, identityProviderRegistry(providerClient, keys.identity));
  const invitationAccess = context.ports.get(INVITATION_ACCESS_PORT);
  const redeemer = new InvitationRedeemer(repository, invitationAccess, telemetry);
  const invited = context.ports.get(INVITATION_MEMBER_PORT);
  const federationRepository = new PgFederationRepository(members, identityAccess);
  const selector = new MembershipSelector(new PgMembershipSelection(), sessions, protector, identityAccess, members, federationRepository, returns, cookies);
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
  const invitationAuthenticator = new InvitationAuthenticator(
    repository,
    invitationAccess,
    hasher,
    protector,
    sessions,
    returns,
    tickets,
    members,
    invited,
    kms,
    keys.session,
    invitationGuard,
    redeemer,
    cookies,
    challenges,
    invitationFailures,
    invitationLookup
  );
  const authentication = new AuthenticationService(
    new CredentialRegistry([
      new PasswordAuthenticator(keys.identity, sessions, returns, tickets, new PgLoginGuard(), identityAccess, members, selector, credentials),
      new OtpAuthenticator(keys.identity, keys.session, sessions, returns, tickets, challenges, identityAccess, members, selector, assurances),
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
  const passwords = new PasswordPolicy();
  const credentialCommands = new ManageCredential(passwords, challenges, members, kms, context.service(RISK_GATE), keys.identity, keys.session, credentials, assurances, sessionRepository, events);
  const stepup = new ManageStepup(members, kms, challenges, keys.identity, keys.session, assurances, sessionRepository, events, context.ports.get(ACTION_PROOF_PORT), new PgStepupRequestRepository());
  const revocation = new RevokeSession(sessionRepository, cookies, events);
  const linker = new IdentityLinker(linkRepository);
  return [
    new SessionsCreateHandler(authentication.action(), new StartFederation(federation).lifecycle(), invitationAuthenticator),
    new SessionsCompleteHandler(new CompleteSession(repository, redeemer, sessions, returns, keys.session, tickets, challenges, cookies, assurances, invitationFailures).lifecycle()),
    new TicketsExchangeHandler(new ExchangeTicket(tickets, returns, csrf, cookies).action()),
    new SessionReadHandler(new ReadSession(members, kms, cookies, credentials).lifecycle()),
    new SessionDeleteHandler(revocation.current()),
    new SessionsReadHandler(new ReadSessions(sessionRepository).action()),
    new SessionsRevokeHandler(revocation.selected()),
    new MembershipsReadHandler(new ReadMemberships(members, identityAccess, context.ports.get(IDENTITY_ORGANIZATION_PORT)).action()),
    new MembershipsSwitchHandler(new SwitchMembership(members, identityAccess, sessions, sessionRepository, events).action()),
    new ChallengesCreateHandler(challengeCommands.lifecycle()),
    new MobileChallengesCreateHandler(challengeCommands.mobile()),
    new InvitationsResolveHandler(new ResolveInvitation(invitationLookup, invitationGuard, telemetry, registrations)),
    new InvitationsReadHandler(new ReadInvitations(repository).action()),
    new InvitationsCreateHandler(new CreateInvitation(repository, invitationAccess, new InvitationGenerator(), hasher, registrations, events, telemetry).action()),
    new InvitationsRevokeHandler(new RevokeInvitation(repository, events).action()),
    new EnrollmentsReadHandler(new ReadEnrollment(repository, registrations).action()),
    new EnrollmentsCompleteHandler(new CompleteEnrollment(kms, enrollments).lifecycle()),
    new MembersManageHandler(new ManageMember(identityAccess, members).action()),
    new PasswordChangeHandler(credentialCommands.change()),
    new PasswordVerifyHandler(credentialCommands.verify()),
    new PasswordResetHandler(credentialCommands.reset()),
    new MobileManageHandler(credentialCommands.mobile()),
    new StepUpStartHandler(stepup.start()),
    new StepUpCompleteHandler(stepup.complete()),
    new ProvidersReadHandler(new ReadIdentityProviders(providers, returns).action()),
    new FederationStartHandler(new StartFederation(federation).lifecycle()),
    new FederationCallbackHandler(new CompleteFederation(federation).lifecycle()),
    new MembershipSelectionReadHandler(new ReadMembershipSelection(selector).action()),
    new FederationCompleteHandler(new SelectMembership(selector, cookies).action()),
    new LinksReadHandler(new ReadIdentityLinks(linker).action()),
    new LinksCreateHandler(new CreateIdentityLink(federation).lifecycle()),
    new LinksRevokeHandler(new RevokeIdentityLink(linker).action()),
    new ProvidersManageHandler(new ManageIdentityProvider(providers, kms).action()),
    new ProvidersTestHandler(new TestIdentityProvider(resolver).lifecycle()),
  ];
}
