import { InvitationDelegation } from '../../application/service/InvitationDelegation';
import type { AccessRepository } from '../../application/port/AccessRepository';
import type { DelegationPolicy } from '../../domain/policy/DelegationPolicy';
import type { ActivateMembership } from '../../application/service/ActivateMembership';
import type { CreateInvitationGrant } from '../../application/service/CreateInvitationGrant';
import type { AccessOrganizationPort } from '../../../organization/public';

export class PgInvitationAccess extends InvitationDelegation {
  constructor(repository: AccessRepository, policy: DelegationPolicy, activation: ActivateMembership, grants: CreateInvitationGrant, organizations: AccessOrganizationPort) {
    super(repository, policy, activation, grants, organizations);
  }
}
