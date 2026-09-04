import type { AuthEnvironment } from '../config/Environment';
import { ReadBootstrap } from '../feature/bootstrap/application/ReadBootstrap';
import { BootstrapGateway } from '../feature/bootstrap/infrastructure/BootstrapGateway';
import { CreateChallenge } from '../feature/challenge/application/CreateChallenge';
import { ChallengeGateway } from '../feature/challenge/infrastructure/ChallengeGateway';
import { ReadProviders } from '../feature/federation/application/ReadProviders';
import { StartFederation } from '../feature/federation/application/StartFederation';
import { FederationGateway } from '../feature/federation/infrastructure/FederationGateway';
import { Authenticate } from '../feature/login/application/Authenticate';
import { LoginGateway } from '../feature/login/infrastructure/LoginGateway';
import { CompleteEnrollment } from '../feature/enrollment/application/CompleteEnrollment';
import { ReadEnrollment } from '../feature/enrollment/application/ReadEnrollment';
import { EnrollmentGateway } from '../feature/enrollment/infrastructure/EnrollmentGateway';
import { ResolveInvitation } from '../feature/invitation/application/ResolveInvitation';
import { InvitationGateway } from '../feature/invitation/infrastructure/InvitationGateway';
import { ReadMemberships } from '../feature/membership/application/ReadMemberships';
import { SelectMembership } from '../feature/membership/application/SelectMembership';
import { MembershipGateway } from '../feature/membership/infrastructure/MembershipGateway';
import { ResetPassword } from '../feature/recovery/application/ResetPassword';
import { RecoveryGateway } from '../feature/recovery/infrastructure/RecoveryGateway';
import { createClient } from '../shared/api/Client';
import { AuthorizationFactory } from '../shared/security/Authorization';
import { deviceId } from '../shared/security/Device';
import { BrowserNavigation } from '../shared/navigation/BrowserNavigation';
import type { NavigationPort } from '../shared/navigation/NavigationPort';
import { ReadLink } from '../feature/link/application/ReadLink';
import { CreateLink } from '../feature/link/application/CreateLink';
import { RevokeLink } from '../feature/link/application/RevokeLink';
import { LinkGateway } from '../feature/link/infrastructure/LinkGateway';
import { FederationViewModel } from '../feature/federation/viewmodel/FederationViewModel';
import { InvitationViewModel } from '../feature/invitation/viewmodel/InvitationViewModel';

export interface Dependencies {
  readonly bootstrap: ReadBootstrap;
  readonly authenticate: Authenticate;
  readonly challenge: CreateChallenge;
  readonly resolveInvitation: ResolveInvitation;
  readonly readEnrollment: ReadEnrollment;
  readonly completeEnrollment: CompleteEnrollment;
  readonly providers: ReadProviders;
  readonly federation: StartFederation;
  readonly memberships: ReadMemberships;
  readonly selectMembership: SelectMembership;
  readonly recovery: ResetPassword;
  readonly clearBootstrap: BootstrapGateway['clear'];
  readonly navigation: NavigationPort;
  readonly readLinks: ReadLink;
  readonly createLink: CreateLink;
  readonly revokeLink: RevokeLink;
  readonly federationView: FederationViewModel;
  readonly invitationView: InvitationViewModel;
}

export function createDependencies(environment: AuthEnvironment): Dependencies {
  const sdk = createClient(environment);
  const authorizations = new AuthorizationFactory();
  deviceId();
  authorizations.prewarm();
  const bootstrapGateway = new BootstrapGateway(sdk, environment);
  const loginGateway = new LoginGateway(sdk, environment, bootstrapGateway, authorizations);
  const challengeGateway = new ChallengeGateway(sdk, environment, bootstrapGateway);
  const invitationGateway = new InvitationGateway(sdk, environment, bootstrapGateway);
  const enrollmentGateway = new EnrollmentGateway(sdk, environment, bootstrapGateway);
  const federationGateway = new FederationGateway(sdk, environment, bootstrapGateway, authorizations);
  const membershipGateway = new MembershipGateway(sdk, environment, bootstrapGateway);
  const recoveryGateway = new RecoveryGateway(sdk, environment, bootstrapGateway);
  const linkGateway = new LinkGateway(sdk, environment, bootstrapGateway, authorizations);
  const providers = new ReadProviders(federationGateway);
  const federation = new StartFederation(federationGateway);
  const resolveInvitation = new ResolveInvitation(invitationGateway);
  const readEnrollment = new ReadEnrollment(enrollmentGateway);
  const completeEnrollment = new CompleteEnrollment(enrollmentGateway);
  return Object.freeze({
    bootstrap: new ReadBootstrap(bootstrapGateway),
    authenticate: new Authenticate(loginGateway),
    challenge: new CreateChallenge(challengeGateway),
    resolveInvitation,
    readEnrollment,
    completeEnrollment,
    providers,
    federation,
    memberships: new ReadMemberships(membershipGateway),
    selectMembership: new SelectMembership(membershipGateway),
    recovery: new ResetPassword(recoveryGateway),
    clearBootstrap: bootstrapGateway.clear.bind(bootstrapGateway),
    navigation: new BrowserNavigation(Object.values(environment.returnOrigins).map((origin) => new URL(origin).origin)),
    readLinks: new ReadLink(linkGateway),
    createLink: new CreateLink(linkGateway),
    revokeLink: new RevokeLink(linkGateway),
    federationView: new FederationViewModel(providers, federation),
    invitationView: new InvitationViewModel(resolveInvitation),
  });
}
