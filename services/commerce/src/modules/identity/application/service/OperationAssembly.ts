import type { RegisteredOperationHandler } from '../../../../foundation/application/OperationHandler';
import { BootstrapReadHandler } from '../handler/BootstrapReadHandler';
import { ChallengesCreateHandler } from '../handler/ChallengesCreateHandler';
import { EnrollmentsCompleteHandler } from '../handler/EnrollmentsCompleteHandler';
import { EnrollmentsReadHandler } from '../handler/EnrollmentsReadHandler';
import { FederationCallbackHandler } from '../handler/FederationCallbackHandler';
import { FederationCompleteHandler } from '../handler/FederationCompleteHandler';
import { FederationStartHandler } from '../handler/FederationStartHandler';
import { InvitationsCreateHandler } from '../handler/InvitationsCreateHandler';
import { InvitationsReadHandler } from '../handler/InvitationsReadHandler';
import { InvitationsResolveHandler } from '../handler/InvitationsResolveHandler';
import { InvitationsRevokeHandler } from '../handler/InvitationsRevokeHandler';
import { LinksCreateHandler } from '../handler/LinksCreateHandler';
import { LinksReadHandler } from '../handler/LinksReadHandler';
import { LinksRevokeHandler } from '../handler/LinksRevokeHandler';
import { MembershipSelectionReadHandler } from '../handler/MembershipSelectionReadHandler';
import { MembershipsReadHandler } from '../handler/MembershipsReadHandler';
import { MembershipsSwitchHandler } from '../handler/MembershipsSwitchHandler';
import { MembersManageHandler } from '../handler/MembersManageHandler';
import { MobileChallengesCreateHandler } from '../handler/MobileChallengesCreateHandler';
import { MobileManageHandler } from '../handler/MobileManageHandler';
import { PasswordChangeHandler } from '../handler/PasswordChangeHandler';
import { PasswordResetHandler } from '../handler/PasswordResetHandler';
import { PasswordVerifyHandler } from '../handler/PasswordVerifyHandler';
import { ProvidersCenterReadHandler } from '../handler/ProvidersCenterReadHandler';
import { ProvidersManageHandler } from '../handler/ProvidersManageHandler';
import { ProvidersReadHandler } from '../handler/ProvidersReadHandler';
import { ProvidersTestHandler } from '../handler/ProvidersTestHandler';
import { SessionDeleteHandler } from '../handler/SessionDeleteHandler';
import { SessionReadHandler } from '../handler/SessionReadHandler';
import { SessionsCompleteHandler } from '../handler/SessionsCompleteHandler';
import { SessionsCreateHandler } from '../handler/SessionsCreateHandler';
import { SessionsReadHandler } from '../handler/SessionsReadHandler';
import { SessionsRevokeHandler } from '../handler/SessionsRevokeHandler';
import { StepUpCompleteHandler } from '../handler/StepUpCompleteHandler';
import { StepUpDisableHandler } from '../handler/StepUpDisableHandler';
import { StepUpStartHandler } from '../handler/StepUpStartHandler';
import { TicketsExchangeHandler } from '../handler/TicketsExchangeHandler';

type IdentityHandlerArguments = Readonly<{
  sessionsCreate: ConstructorParameters<typeof SessionsCreateHandler>;
  sessionsComplete: ConstructorParameters<typeof SessionsCompleteHandler>;
  ticketsExchange: ConstructorParameters<typeof TicketsExchangeHandler>;
  sessionRead: ConstructorParameters<typeof SessionReadHandler>;
  sessionDelete: ConstructorParameters<typeof SessionDeleteHandler>;
  sessionsRead: ConstructorParameters<typeof SessionsReadHandler>;
  sessionsRevoke: ConstructorParameters<typeof SessionsRevokeHandler>;
  membershipsRead: ConstructorParameters<typeof MembershipsReadHandler>;
  membershipsSwitch: ConstructorParameters<typeof MembershipsSwitchHandler>;
  challengesCreate: ConstructorParameters<typeof ChallengesCreateHandler>;
  mobileChallengesCreate: ConstructorParameters<typeof MobileChallengesCreateHandler>;
  invitationsResolve: ConstructorParameters<typeof InvitationsResolveHandler>;
  invitationsRead: ConstructorParameters<typeof InvitationsReadHandler>;
  invitationsCreate: ConstructorParameters<typeof InvitationsCreateHandler>;
  invitationsRevoke: ConstructorParameters<typeof InvitationsRevokeHandler>;
  enrollmentsRead: ConstructorParameters<typeof EnrollmentsReadHandler>;
  enrollmentsComplete: ConstructorParameters<typeof EnrollmentsCompleteHandler>;
  membersManage: ConstructorParameters<typeof MembersManageHandler>;
  passwordChange: ConstructorParameters<typeof PasswordChangeHandler>;
  passwordVerify: ConstructorParameters<typeof PasswordVerifyHandler>;
  passwordReset: ConstructorParameters<typeof PasswordResetHandler>;
  mobileManage: ConstructorParameters<typeof MobileManageHandler>;
  stepUpStart: ConstructorParameters<typeof StepUpStartHandler>;
  stepUpComplete: ConstructorParameters<typeof StepUpCompleteHandler>;
  stepUpDisable: ConstructorParameters<typeof StepUpDisableHandler>;
  bootstrapRead: ConstructorParameters<typeof BootstrapReadHandler>;
  providersRead: ConstructorParameters<typeof ProvidersReadHandler>;
  providersCenterRead: ConstructorParameters<typeof ProvidersCenterReadHandler>;
  federationStart: ConstructorParameters<typeof FederationStartHandler>;
  federationCallback: ConstructorParameters<typeof FederationCallbackHandler>;
  membershipSelectionRead: ConstructorParameters<typeof MembershipSelectionReadHandler>;
  federationComplete: ConstructorParameters<typeof FederationCompleteHandler>;
  linksRead: ConstructorParameters<typeof LinksReadHandler>;
  linksCreate: ConstructorParameters<typeof LinksCreateHandler>;
  linksRevoke: ConstructorParameters<typeof LinksRevokeHandler>;
  providersManage: ConstructorParameters<typeof ProvidersManageHandler>;
  providersTest: ConstructorParameters<typeof ProvidersTestHandler>;
}>;

export function assembleOperations(input: IdentityHandlerArguments): readonly RegisteredOperationHandler[] {
  return [
    new SessionsCreateHandler(...input.sessionsCreate),
    new SessionsCompleteHandler(...input.sessionsComplete),
    new TicketsExchangeHandler(...input.ticketsExchange),
    new SessionReadHandler(...input.sessionRead),
    new SessionDeleteHandler(...input.sessionDelete),
    new SessionsReadHandler(...input.sessionsRead),
    new SessionsRevokeHandler(...input.sessionsRevoke),
    new MembershipsReadHandler(...input.membershipsRead),
    new MembershipsSwitchHandler(...input.membershipsSwitch),
    new ChallengesCreateHandler(...input.challengesCreate),
    new MobileChallengesCreateHandler(...input.mobileChallengesCreate),
    new InvitationsResolveHandler(...input.invitationsResolve),
    new InvitationsReadHandler(...input.invitationsRead),
    new InvitationsCreateHandler(...input.invitationsCreate),
    new InvitationsRevokeHandler(...input.invitationsRevoke),
    new EnrollmentsReadHandler(...input.enrollmentsRead),
    new EnrollmentsCompleteHandler(...input.enrollmentsComplete),
    new MembersManageHandler(...input.membersManage),
    new PasswordChangeHandler(...input.passwordChange),
    new PasswordVerifyHandler(...input.passwordVerify),
    new PasswordResetHandler(...input.passwordReset),
    new MobileManageHandler(...input.mobileManage),
    new StepUpStartHandler(...input.stepUpStart),
    new StepUpCompleteHandler(...input.stepUpComplete),
    new StepUpDisableHandler(...input.stepUpDisable),
    new BootstrapReadHandler(...input.bootstrapRead),
    new ProvidersReadHandler(...input.providersRead),
    new ProvidersCenterReadHandler(...input.providersCenterRead),
    new FederationStartHandler(...input.federationStart),
    new FederationCallbackHandler(...input.federationCallback),
    new MembershipSelectionReadHandler(...input.membershipSelectionRead),
    new FederationCompleteHandler(...input.federationComplete),
    new LinksReadHandler(...input.linksRead),
    new LinksCreateHandler(...input.linksCreate),
    new LinksRevokeHandler(...input.linksRevoke),
    new ProvidersManageHandler(...input.providersManage),
    new ProvidersTestHandler(...input.providersTest),
  ];
}
