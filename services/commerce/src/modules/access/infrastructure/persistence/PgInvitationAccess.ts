import { DelegationService } from '../../application/service/DelegationService';
import type { AccessRepository } from '../../application/port/AccessRepository';
import type { DelegationPolicy } from '../../domain/policy/DelegationPolicy';
import type { ActivateMembership } from '../../application/service/ActivateMembership';
import type { CreateInvitationGrant } from '../../application/service/CreateInvitationGrant';

export class PgInvitationAccess extends DelegationService {
  constructor(repository: AccessRepository, policy: DelegationPolicy, activation: ActivateMembership, grants: CreateInvitationGrant) {
    super(repository, policy, activation, grants);
  }
}
