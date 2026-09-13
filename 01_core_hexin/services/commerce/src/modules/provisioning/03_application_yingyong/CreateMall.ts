import { createHash } from 'node:crypto';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import {
  catalogProvisioningPort,
  type CatalogProvisioningPort,
} from '../../catalog/01_public_gongkai/CatalogProvisioningPort';
import { experienceProvisioningPort, type ExperienceProvisioningPort } from '../../experience';
import {
  mallOrganizationProvisioningPort,
  type MallOrganizationProvisioningPort,
} from '../../organization/MallOrganizationProvisioningPort';
import {
  mallOwnerProvisioningPort,
  type CreatedMall,
  type MallOwnerProvisioningPort,
} from '../01_public_gongkai/MallOwnerProvisioningPort';

export type { CreatedMall } from '../01_public_gongkai/MallOwnerProvisioningPort';

export interface CreateMallInput {
  readonly scope: string;
  readonly parent: string;
  readonly code: string;
  readonly publicSlug: string;
  readonly name: string;
  readonly actor: string;
  readonly actorMembership: string;
}

export interface MallProvisioningPlan extends CreateMallInput {
  readonly mall: string;
  readonly pool: string;
  readonly application: string;
  readonly version: string;
  readonly ownerMembership: string;
}

export type MallProvisioningConflict = 'MALL_PARENT_INVALID' | 'MALL_CODE_CONFLICT' | 'MALL_PUBLIC_SLUG_CONFLICT';

export class CreateMall {
  constructor(
    private readonly organizations: MallOrganizationProvisioningPort = mallOrganizationProvisioningPort,
    private readonly catalog: CatalogProvisioningPort = catalogProvisioningPort,
    private readonly experience: ExperienceProvisioningPort = experienceProvisioningPort,
    private readonly owners: MallOwnerProvisioningPort = mallOwnerProvisioningPort,
  ) {}

  async allocatePublicSlug(database: OperationDatabase): Promise<string> {
    return await this.experience.allocateH5PublicSlug(database);
  }

  plan(input: CreateMallInput): MallProvisioningPlan {
    const mall = stableId('mall', `${input.parent}:${input.code}`);
    const application = stableId('application', input.publicSlug);
    return Object.freeze({
      ...input,
      mall,
      application,
      pool: stableId('pool', `${mall}:default`),
      version: stableId('version', `${application}:initial`),
      ownerMembership: stableId('membership', `${mall}:${input.actor}:owner`),
    });
  }

  async preflight(database: OperationDatabase, plan: MallProvisioningPlan): Promise<MallProvisioningConflict | null> {
    const organizationConflict = await this.organizations.conflict(database, {
      scope: plan.scope,
      parent: plan.parent,
      code: plan.code,
    });
    if (organizationConflict !== null) return organizationConflict;
    return await this.experience.publicSlugConflict(database, plan.publicSlug, plan.application)
      ? 'MALL_PUBLIC_SLUG_CONFLICT'
      : null;
  }

  async execute(database: OperationDatabase, plan: MallProvisioningPlan): Promise<CreatedMall> {
    await this.organizations.create(database, {
      id: plan.mall,
      scope: plan.scope,
      parent: plan.parent,
      code: plan.code,
      name: plan.name,
      timezone: 'Asia/Shanghai',
    });
    await this.catalog.createMallPool(database, { mall: plan.mall, pool: plan.pool, name: plan.name });
    await this.experience.createMallApplication(database, {
      mall: plan.mall,
      application: plan.application,
      version: plan.version,
      pool: plan.pool,
      code: plan.code,
      publicSlug: plan.publicSlug,
      name: plan.name,
      actor: plan.actor,
    });
    const owner = await this.owners.create(database, {
      sourceMembership: plan.actorMembership,
      principal: plan.actor,
      membership: plan.ownerMembership,
      organization: plan.mall,
      scope: plan.mall,
      mall: plan.mall,
    });
    return Object.freeze({
      organizationId: plan.mall,
      scopeId: plan.mall,
      mallId: plan.mall,
      parentId: plan.parent,
      enterpriseId: plan.parent,
      applicationId: plan.application,
      poolId: plan.pool,
      ownerMembershipId: owner.membership,
      ownerMemberId: owner.member,
      ownerPrincipalId: owner.principal,
      code: plan.code,
      publicSlug: plan.publicSlug,
      name: plan.name,
      state: 'ready',
      publicationState: 'draft',
    });
  }

  async read(database: OperationDatabase, mall: string): Promise<CreatedMall | null> {
    return this.owners.read(database, mall);
  }
}

function stableId(prefix: string, source: string): string {
  return `${prefix}:${createHash('sha256').update(source).digest('hex').slice(0, 32)}`;
}
