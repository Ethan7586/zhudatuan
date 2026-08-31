import { defineModule } from '../../bootstrap/DefinedModule';
import { accessOperations } from './AccessOperations';
import { Manifest } from './Manifest';
import { AccessPort } from './AccessPort';
import { IDENTITY_ACCESS_PORT } from './public/IdentityAccessPort';
import { MEMBER_ACCESS_PORT } from './public/index';
import { NAVIGATION_ACCESS_PORT } from './public/NavigationAccessPort';
import { PgNavigationAccess } from './infrastructure/PgNavigationAccess';
import { PgInvitationAccess } from './infrastructure/persistence/PgInvitationAccess';
import { INVITATION_ACCESS_PORT } from './public/InvitationAccessPort';
import { ACCESS_ORGANIZATION_PORT } from '../organization/public';
import { ACCESS_PARTNER_PORT } from '../partner/public';
import { MEMBER_IMPORT_ACCESS_PORT } from './public/MemberImportAccessPort';
import { MEMBERSHIP_READ_PORT, PgMembershipReadPort } from './public/MembershipReadPort';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { readDatabaseWorkload } from '../../foundation/persistence/Workload';
import { PgAccessRepository } from './infrastructure/persistence/PgAccessRepository';
import { PgAuthorizationRepository } from './infrastructure/persistence/PgAuthorizationRepository';
import { AccessVersionService } from './application/service/AccessVersionService';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { DelegationPolicy } from './domain/policy/DelegationPolicy';
import { ActivateMembership } from './application/command/ActivateMembership';
import { CreateInvitationGrant } from './application/command/CreateInvitationGrant';
import { ACTION_PROOF_PORT, PgActionProofPort } from './public/ActionProofPort';
import { AUTHORIZATION_PORT, PgAuthorizationPort } from './public/AuthorizationPort';

interface AccessComposition {
  readonly access: AccessPort;
  readonly authorization: PgAuthorizationRepository;
  readonly invitation: PgInvitationAccess;
  readonly repository: PgAccessRepository;
  readonly versions: AccessVersionService;
}
const compositions = new WeakMap<ModuleContext, AccessComposition>();

export const AccessModule = defineModule(
  Manifest,
  (context) => {
    const composition = compose(context);
    return accessOperations(context, composition.repository, composition.versions);
  },
  (context) => {
    const composition = compose(context);
    const authorizationPort = new PgAuthorizationPort(composition.authorization);
    return [
      { token: IDENTITY_ACCESS_PORT, value: composition.access },
      { token: MEMBER_ACCESS_PORT, value: composition.access },
      { token: MEMBER_IMPORT_ACCESS_PORT, value: composition.access },
      ...(context.workload === 'api' ? [{ token: MEMBERSHIP_READ_PORT, value: new PgMembershipReadPort(context.service(DATABASE_POOL), readDatabaseWorkload(context.workload)) }] : []),
      { token: NAVIGATION_ACCESS_PORT, value: new PgNavigationAccess(composition.authorization) },
      { token: INVITATION_ACCESS_PORT, value: composition.invitation },
      { token: AUTHORIZATION_PORT, value: authorizationPort },
      { token: ACTION_PROOF_PORT, value: new PgActionProofPort(authorizationPort) },
    ];
  }
);

function compose(context: ModuleContext): AccessComposition {
  const current = compositions.get(context);
  if (current) return current;
  const repository = new PgAccessRepository();
  const authorization = new PgAuthorizationRepository();
  const versions = new AccessVersionService(repository);
  const access = new AccessPort(repository, versions);
  const grants = new CreateInvitationGrant(context.ports.get(ACCESS_ORGANIZATION_PORT), context.ports.get(ACCESS_PARTNER_PORT), repository, authorization);
  const invitation = new PgInvitationAccess(repository, new DelegationPolicy(), new ActivateMembership(versions), grants);
  const value = Object.freeze({ access, authorization, invitation, repository, versions });
  compositions.set(context, value);
  return value;
}
