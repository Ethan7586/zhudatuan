import type { ModuleContext } from '../../../../composition/ModuleRegistry';
import { KMS_CLIENT } from '../../../../pipeline/KmsPort';
import { IDENTITY_SECURITY_KEYS, SECRET_STORE } from '../../../../platform/secret/SecretStore';
import { DATABASE_POOL } from '../../../../platform/database/Pool';
import { CSRF_PROTECTOR } from '../../../../platform/security/CsrfProtector';
import { RISK_GATE } from '../../../../platform/security/RiskGate';
import { ACTION_PROOF_PORT, IDENTITY_ACCESS_PORT, INVITATION_ACCESS_PORT, MEMBERSHIP_READ_PORT } from '../../../access/public';
import { IDENTITY_MEMBER_PORT, IDENTITY_REGISTRATION_PORT, MEMBER_READ_PORT } from '../../../member/public';
import { IDENTITY_ORGANIZATION_PORT } from '../../../organization/public';
import { IDENTITY_EXPERIENCE_PORT } from '../../../experience/public';
import { AuthenticateIdentity } from '../../application/service/AuthenticateIdentity';
import { OtpAuthenticator } from '../../application/service/OtpAuthenticator';
import { PasswordAuthenticator } from '../../application/service/PasswordAuthenticator';
import { CompleteEnrollment } from '../../application/service/CompleteEnrollment';
import { CompleteFederation } from '../../application/service/CompleteFederation';
import { CompleteSession } from '../../application/service/CompleteSession';
import { CreateChallenge } from '../../application/service/CreateChallenge';
import { CreateInvitation } from '../../application/service/CreateInvitation';
import { PrepareEmployeeInvitation } from '../../application/service/PrepareEmployeeInvitation';
import { CreateIdentityLink } from '../../application/service/CreateIdentityLink';
import { ExchangeTicket } from '../../application/service/ExchangeTicket';
import { ManageCredential } from '../../application/service/ManageCredential';
import { ManageMember } from '../../application/service/ManageMember';
import { ManageIdentityProvider } from '../../application/service/ManageIdentityProvider';
import { ManageStepup } from '../../application/service/ManageStepup';
import { RevokeInvitation } from '../../application/service/RevokeInvitation';
import { RevokeIdentityLink } from '../../application/service/RevokeIdentityLink';
import { RevokeSession } from '../../application/service/RevokeSession';
import { SelectMembership } from '../../application/service/SelectMembership';
import { StartFederation } from '../../application/service/StartFederation';
import { TestIdentityProvider } from '../../application/service/TestIdentityProvider';
import { ReadEnrollment } from '../../application/service/ReadEnrollment';
import { ReadInvitations } from '../../application/service/ReadInvitations';
import { ReadIdentityLinks } from '../../application/service/ReadIdentityLinks';
import { ReadIdentityBootstrap } from '../../application/service/ReadIdentityBootstrap';
import { ReadIdentityProviders } from '../../application/service/ReadIdentityProviders';
import { ReadMembershipSelection } from '../../application/service/ReadMembershipSelection';
import { ReadSession } from '../../application/service/ReadSession';
import { ReadSessions } from '../../application/service/ReadSessions';
import { ReadMemberships } from '../../application/service/ReadMemberships';
import { SwitchMembership } from '../../application/service/SwitchMembership';
import { ResolveInvitation } from '../../application/service/ResolveInvitation';
import { DefaultSessionIssuer } from '../../application/service/DefaultSessionIssuer';
import { IdentityLinker } from '../../application/service/IdentityLinker';
import { PasswordPolicy } from '../../domain/policy/PasswordPolicy';
import { FederationProtector } from '../../domain/service/FederationProtector';
import { PgAuthTicket } from '../persistence/PgAuthTicket';
import { PgInvitationRepository } from '../persistence/PgInvitationRepository';
import { PgSessionRepository } from '../persistence/PgSessionRepository';
import { PgHandoverRepository } from '../persistence/PgHandoverRepository';
import { PgAssuranceRepository } from '../persistence/PgAssuranceRepository';
import { PgEnrollmentRepository } from '../persistence/PgEnrollmentRepository';
import { PgIdentityEvent } from '../persistence/PgIdentityEvent';
import { PgCredentialRepository } from '../persistence/PgCredentialRepository';
import { PgRegistrationPolicyRepository } from '../persistence/PgRegistrationPolicyRepository';
import { PgRegistrationResetRepository } from '../persistence/PgRegistrationResetRepository';
import { CredentialRegistry } from './CredentialRegistry';
import { composeFederation } from './FederationComposition';
import { RETURN_TARGETS } from '../security/ReturnTargetCatalog';
import { ReturnTargetSigner } from '../security/ReturnTargetSigner';
import { InvitationGenerator } from '../security/InvitationGenerator';
import { InvitationHasher } from '../security/InvitationHasher';
import { PgChallenge, PgLoginGuard } from '../persistence/PgChallenge';
import { PgPreauthResolver } from '../security/PgPreauthResolver';
import { PgInvitationRate } from '../persistence/PgInvitationRate';
import { PgTransactionManager } from '../../../../platform/database/PgTransactionManager';
import { InvitationGuard } from '../../application/service/InvitationGuard';
import { TELEMETRY } from '../../../../platform/telemetry/Telemetry';
import { InvitationRedeemer } from '../../application/service/InvitationRedeemer';
import { SessionCookieAdapter } from '../security/SessionCookie';
import { EnrollIdentity } from '../../application/service/EnrollIdentity';
import { InvitationFailure } from '../../application/service/InvitationFailure';
import { InvitationLookup } from '../../application/service/InvitationLookup';
import { PgStepupRequestRepository } from '../persistence/PgStepupRequestRepository';
import { assembleOperations } from '../../application/service/OperationAssembly';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { SessionPolicy } from '../../domain/policy/SessionPolicy';
import { MembershipDestination } from '../../application/service/MembershipDestination';

export function composeIdentity(context: ModuleContext) {
  const pool = context.service(DATABASE_POOL);
  const keys = context.service(IDENTITY_SECURITY_KEYS);
  const kms = context.service(KMS_CLIENT);
  const csrf = context.service(CSRF_PROTECTOR);
  const telemetry = context.service(TELEMETRY);
  const repository = new PgInvitationRepository();
  const invitationGenerator = new InvitationGenerator();
  const hasher = new InvitationHasher(keys.invitation);
  const returns = new ReturnTargetSigner(context.service(RETURN_TARGETS), keys.session);
  const invitationLookup = new InvitationLookup(repository, hasher);
  const sessionPolicy = new SessionPolicy(RUNTIME_LIMITS.authentication.session.ttlSeconds);
  const cookies = new SessionCookieAdapter(sessionPolicy.ttlSeconds);
  const assurances = new PgAssuranceRepository();
  const events = new PgIdentityEvent();
  const invitationFailures = new InvitationFailure(events);
  const credentials = new PgCredentialRepository();
  const registrations = new PgRegistrationPolicyRepository();
  const registrationResets = new PgRegistrationResetRepository();
  const protector = new FederationProtector(keys.session);
  const preauth = new PgPreauthResolver(pool, protector);
  const invitationGuard = new InvitationGuard(new PgInvitationRate(new PgTransactionManager(pool), telemetry), context.service(RISK_GATE), protector);
  const tickets = new PgAuthTicket();
  const identityAccess = context.ports.get(IDENTITY_ACCESS_PORT);
  const members = context.ports.get(IDENTITY_MEMBER_PORT);
  const sessionRepository = new PgSessionRepository();
  const sessions = new DefaultSessionIssuer(csrf, keys.identity, identityAccess, cookies, sessionRepository, sessionPolicy);
  const challenges = new PgChallenge();
  const invitationAccess = context.ports.get(INVITATION_ACCESS_PORT);
  const redeemer = new InvitationRedeemer(repository, invitationAccess, telemetry);
  const invited = context.ports.get(IDENTITY_REGISTRATION_PORT);
  const organizations = context.ports.get(IDENTITY_ORGANIZATION_PORT);
  const destinations = new MembershipDestination(returns, context.ports.get(IDENTITY_EXPERIENCE_PORT));
  const challengeCommands = new CreateChallenge(kms, context.service(RISK_GATE), challenges, keys.identity, keys.session, preauth, repository, hasher, events, credentials, members, invitationAccess, invited);
  const {
    providers,
    resolver,
    selector,
    cases: linkcases,
    links: linkRepository,
    federation,
  } = composeFederation({
    secrets: context.service(SECRET_STORE),
    identityKey: keys.identity,
    members,
    access: identityAccess,
    sessions,
    protector,
    kms,
    returns,
    organizations,
    destinations,
    cookies,
  });
  const authentication = new AuthenticateIdentity(
    new CredentialRegistry([
      new PasswordAuthenticator(keys.identity, sessions, returns, tickets, new PgLoginGuard(), identityAccess, members, selector, destinations, credentials),
      new OtpAuthenticator(keys.identity, keys.session, sessions, returns, tickets, challenges, identityAccess, members, selector, destinations, assurances),
    ])
  );
  const enrollmentRepository = new PgEnrollmentRepository();
  const enrollments = new EnrollIdentity(
    repository,
    invitationAccess,
    invited,
    sessions,
    hasher,
    keys.identity,
    keys.session,
    tickets,
    challenges,
    linkcases,
    redeemer,
    cookies,
    telemetry,
    enrollmentRepository,
    assurances,
    events,
    invitationFailures
  );
  const invitationCreation = new CreateInvitation(
    repository,
    invitationAccess,
    invited,
    enrollmentRepository,
    new PrepareEmployeeInvitation(kms, invitationGenerator, hasher),
    kms,
    invitationGenerator,
    hasher,
    registrations,
    events,
    telemetry
  ).lifecycle();
  const passwords = new PasswordPolicy();
  const credentialCommands = new ManageCredential(passwords, challenges, members, kms, context.service(RISK_GATE), keys.identity, keys.session, credentials, assurances, sessionRepository, events);
  const stepup = new ManageStepup(members, kms, challenges, keys.identity, keys.session, assurances, sessionRepository, events, context.ports.get(ACTION_PROOF_PORT), new PgStepupRequestRepository());
  const revocation = new RevokeSession(sessionRepository, cookies, events);
  const handovers = new PgHandoverRepository();
  const linker = new IdentityLinker(linkRepository);
  return assembleOperations({
    sessionsCreate: [authentication.lifecycle(), new StartFederation(federation).lifecycle()],
    sessionsComplete: [new CompleteSession(repository, redeemer, sessions, returns, keys.session, tickets, challenges, cookies, assurances, invitationFailures).lifecycle()],
    ticketsExchange: [new ExchangeTicket(tickets, returns, csrf, cookies, sessionPolicy).action()],
    sessionRead: [new ReadSession(members, kms, cookies, credentials).lifecycle()],
    sessionDelete: [revocation.current()],
    handoversRead: [handovers],
    handoversCreate: [handovers, sessionRepository, cookies, events],
    sessionsRead: [new ReadSessions(sessionRepository).action()],
    sessionsRevoke: [revocation.selected()],
    membershipsRead: [new ReadMemberships(members, identityAccess).action()],
    membershipsSwitch: [new SwitchMembership(members, identityAccess, sessions, sessionRepository, events).action()],
    challengesCreate: [challengeCommands.lifecycle()],
    mobileChallengesCreate: [challengeCommands.mobile()],
    invitationsResolve: [
      new ResolveInvitation(
        repository,
        invitationAccess,
        invited,
        organizations,
        invitationLookup,
        invitationGuard,
        protector,
        kms,
        hasher,
        keys.session,
        sessions,
        tickets,
        returns,
        cookies,
        challenges,
        redeemer,
        invitationFailures,
        registrations,
        telemetry
      ),
    ],
    invitationsRead: [new ReadInvitations(repository, context.ports.get(MEMBERSHIP_READ_PORT), context.ports.get(MEMBER_READ_PORT)).action()],
    invitationsCreate: [invitationCreation],
    invitationsRevoke: [new RevokeInvitation(repository, events).action()],
    enrollmentsRead: [new ReadEnrollment(repository, registrations, invitationAccess, invited, organizations).action()],
    enrollmentsComplete: [new CompleteEnrollment(kms, enrollments).lifecycle()],
    membersManage: [new ManageMember(identityAccess, members, registrationResets, events).action(), invitationCreation],
    passwordChange: [credentialCommands.change()],
    passwordVerify: [credentialCommands.verify()],
    passwordReset: [credentialCommands.reset()],
    mobileManage: [credentialCommands.mobile()],
    stepUpStart: [stepup.start()],
    stepUpComplete: [stepup.complete()],
    stepUpDisable: [stepup.disable()],
    bootstrapRead: [new ReadIdentityBootstrap(returns, registrations).action()],
    providersRead: [new ReadIdentityProviders(providers, returns).action()],
    providersCenterRead: [providers],
    federationStart: [new StartFederation(federation).lifecycle()],
    federationCallback: [new CompleteFederation(federation).lifecycle()],
    membershipSelectionRead: [new ReadMembershipSelection(selector).action()],
    federationComplete: [new SelectMembership(selector, cookies).action()],
    linksRead: [new ReadIdentityLinks(linker).action()],
    linksCreate: [new CreateIdentityLink(federation).lifecycle()],
    linksRevoke: [new RevokeIdentityLink(linker).action()],
    providersManage: [new ManageIdentityProvider(providers, kms).action()],
    providersTest: [new TestIdentityProvider(resolver).lifecycle()],
  });
}
