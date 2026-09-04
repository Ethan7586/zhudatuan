import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

export interface CreatedMall {
  readonly organizationId: string;
  readonly scopeId: string;
  readonly mallId: string;
  readonly parentId: string;
  readonly enterpriseId: string;
  readonly applicationId: string;
  readonly poolId: string;
  readonly ownerMembershipId: string;
  readonly ownerMemberId: string;
  readonly ownerPrincipalId: string;
  readonly code: string;
  readonly publicSlug: string;
  readonly name: string;
  readonly state: 'ready';
  readonly publicationState: 'draft';
}

export interface MallOwnerProvisioning {
  readonly sourceMembership: string;
  readonly principal: string;
  readonly membership: string;
  readonly organization: string;
  readonly scope: string;
  readonly mall: string;
}

export interface ProvisionedMallOwner {
  readonly membership: string;
  readonly member: string;
  readonly principal: string;
}

interface ProvisionedMallRow {
  readonly organization_id: string;
  readonly scope_id: string;
  readonly mall_id: string;
  readonly parent_id: string;
  readonly owner_membership_id: string;
  readonly owner_member_id: string;
  readonly owner_principal_id: string;
  readonly application_id: string;
  readonly pool_id: string;
  readonly code: string;
  readonly public_slug: string;
  readonly name: string;
  readonly state: 'ready';
  readonly publication_state: 'draft';
}

export class MallOwnerProvisioningPort {
  async create(database: OperationDatabase, input: MallOwnerProvisioning): Promise<ProvisionedMallOwner> {
    const result = await database.query<{
      membership_id: string;
      member_id: string;
      principal_id: string;
    }>('select membership_id,member_id,principal_id from access.provision_mall_owner($1,$2,$3,$4,$5,$6)', [
      input.sourceMembership,
      input.principal,
      input.membership,
      input.organization,
      input.scope,
      input.mall,
    ]);
    const owner = result.rows[0];
    if (!owner) throw new Error('MALL_OWNER_PROVISIONING_FAILED');
    return Object.freeze({ membership: owner.membership_id, member: owner.member_id, principal: owner.principal_id });
  }

  async read(database: OperationDatabase, mall: string): Promise<CreatedMall | null> {
    const result = await database.query<ProvisionedMallRow>(
      'select * from access.read_provisioned_mall($1)', [mall],
    );
    const row = result.rows[0];
    if (!row) return null;
    return Object.freeze({
      organizationId: row.organization_id,
      scopeId: row.scope_id,
      mallId: row.mall_id,
      parentId: row.parent_id,
      enterpriseId: row.parent_id,
      applicationId: row.application_id,
      poolId: row.pool_id,
      ownerMembershipId: row.owner_membership_id,
      ownerMemberId: row.owner_member_id,
      ownerPrincipalId: row.owner_principal_id,
      code: row.code,
      publicSlug: row.public_slug,
      name: row.name,
      state: row.state,
      publicationState: row.publication_state,
    });
  }
}

export const mallOwnerProvisioningPort = new MallOwnerProvisioningPort();
