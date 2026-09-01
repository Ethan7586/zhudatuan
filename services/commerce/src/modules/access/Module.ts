import { PgMembershipReadPort } from './infrastructure/persistence/PgMembershipReadPort';
import { PgAuthorizationPort } from './infrastructure/persistence/PgAuthorizationPort';
import { PgActionProofPort } from './infrastructure/persistence/PgActionProofPort';

import { defineModule } from '../../bootstrap/DefinedModule';
import { Manifest } from './Manifest';
import { AccessPort } from './application/service/AccessPort';
import { IDENTITY_ACCESS_PORT } from './public/IdentityAccessPort';
import { MEMBER_ACCESS_PORT } from './public/index';
import { NAVIGATION_ACCESS_PORT } from './public/NavigationAccessPort';
import { PgNavigationAccess } from './infrastructure/persistence/PgNavigationAccess';
import { PgInvitationAccess } from './infrastructure/persistence/PgInvitationAccess';
import { INVITATION_ACCESS_PORT } from './public/InvitationAccessPort';
import { ACCESS_ORGANIZATION_PORT } from '../organization/public';
import { ACCESS_PARTNER_PORT } from '../partner/public';
import { MEMBER_IMPORT_ACCESS_PORT } from './public/MemberImportAccessPort';
import { MEMBERSHIP_READ_PORT } from './public/MembershipReadPort';
import { PgAccessRepository } from './infrastructure/persistence/PgAccessRepository';
import { PgAuthorizationRepository } from './infrastructure/persistence/PgAuthorizationRepository';
import { AccessVersionService } from './application/service/AccessVersionService';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { DelegationPolicy } from './domain/policy/DelegationPolicy';
import { ActivateMembership } from './application/service/ActivateMembership';
import { CreateInvitationGrant } from './application/service/CreateInvitationGrant';
import { ACTION_PROOF_PORT } from './public/ActionProofPort';
import { AUTHORIZATION_PORT } from './public/AuthorizationPort';
import { CenterReadHandler } from './application/handler/CenterReadHandler';
import { OwnersTransferHandler } from './application/handler/OwnersTransferHandler';
import { RolesManageHandler } from './application/handler/RolesManageHandler';
import { OverridesManageHandler } from './application/handler/OverridesManageHandler';
import { ScopesManageHandler } from './application/handler/ScopesManageHandler';
import { PgAccessAdministrationRepository } from './infrastructure/persistence/PgAccessAdministrationRepository';

interface AccessComposition {
  readonly access: AccessPort;
  readonly authorization: PgAuthorizationRepository;
  readonly invitation: PgInvitationAccess;
  readonly repository: PgAccessRepository;
  readonly versions: AccessVersionService;
}
export const AccessModule = defineModule(Manifest, {
  handlers: () => {
    const access = new PgAccessAdministrationRepository();
    return [new CenterReadHandler(access), new OwnersTransferHandler(access), new RolesManageHandler(access), new OverridesManageHandler(access), new ScopesManageHandler(access)];
  },
  ports: (context) => {
    const composition = compose(context);
    const authorizationPort = new PgAuthorizationPort(composition.authorization);
    return [
      { token: IDENTITY_ACCESS_PORT, value: composition.access },
      { token: MEMBER_ACCESS_PORT, value: composition.access },
      { token: MEMBER_IMPORT_ACCESS_PORT, value: composition.access },
      { token: MEMBERSHIP_READ_PORT, value: new PgMembershipReadPort() },
      { token: NAVIGATION_ACCESS_PORT, value: new PgNavigationAccess(composition.authorization) },
      { token: INVITATION_ACCESS_PORT, value: composition.invitation },
      { token: AUTHORIZATION_PORT, value: authorizationPort },
      { token: ACTION_PROOF_PORT, value: new PgActionProofPort(authorizationPort) },
    ];
  },
  jobPorts: () => {
    const repository = new PgAccessRepository();
    const access = new AccessPort(repository, new AccessVersionService(repository));
    return [
      { token: IDENTITY_ACCESS_PORT, value: access },
      { token: MEMBER_IMPORT_ACCESS_PORT, value: access },
    ];
  },
});

function compose(context: ModuleContext): AccessComposition {
  const repository = new PgAccessRepository();
  const authorization = new PgAuthorizationRepository();
  const versions = new AccessVersionService(repository);
  const access = new AccessPort(repository, versions);
  const grants = new CreateInvitationGrant(context.ports.get(ACCESS_ORGANIZATION_PORT), context.ports.get(ACCESS_PARTNER_PORT), repository, authorization);
  const invitation = new PgInvitationAccess(repository, new DelegationPolicy(), new ActivateMembership(versions), grants);
  return Object.freeze({ access, authorization, invitation, repository, versions });
}
