import { createHash } from 'node:crypto';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { catalogProvisioningPort, type CatalogProvisioningPort } from '../../catalog/CatalogProvisioningPort';
import { experienceProvisioningPort, type ExperienceProvisioningPort } from '../../experience/ExperienceProvisioningPort';
import {
  mallOrganizationProvisioningPort,
  type MallOrganizationProvisioningPort,
} from '../../organization/MallOrganizationProvisioningPort';

export interface CreateMallInput {
  readonly scope: string;
  readonly enterprise: string;
  readonly code: string;
  readonly publicSlug: string;
  readonly name: string;
  readonly actor: string;
}

export interface MallProvisioningPlan extends CreateMallInput {
  readonly mall: string;
  readonly pool: string;
  readonly application: string;
  readonly version: string;
}

export interface CreatedMall {
  readonly mallId: string;
  readonly enterpriseId: string;
  readonly applicationId: string;
  readonly poolId: string;
  readonly code: string;
  readonly publicSlug: string;
  readonly name: string;
  readonly state: 'ready';
  readonly publicationState: 'draft';
}

export type MallProvisioningConflict = 'MALL_PARENT_INVALID' | 'MALL_CODE_CONFLICT' | 'MALL_PUBLIC_SLUG_CONFLICT';

export class CreateMall {
  constructor(
    private readonly organizations: MallOrganizationProvisioningPort = mallOrganizationProvisioningPort,
    private readonly catalog: CatalogProvisioningPort = catalogProvisioningPort,
    private readonly experience: ExperienceProvisioningPort = experienceProvisioningPort,
  ) {}

  plan(input: CreateMallInput): MallProvisioningPlan {
    const mall = stableId('mall', `${input.enterprise}:${input.code}`);
    const application = stableId('application', input.publicSlug);
    return Object.freeze({
      ...input,
      mall,
      application,
      pool: stableId('pool', `${mall}:default`),
      version: stableId('version', `${application}:initial`),
    });
  }

  async preflight(database: OperationDatabase, plan: MallProvisioningPlan): Promise<MallProvisioningConflict | null> {
    const organizationConflict = await this.organizations.conflict(database, {
      scope: plan.scope,
      parent: plan.enterprise,
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
      parent: plan.enterprise,
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
    return Object.freeze({
      mallId: plan.mall,
      enterpriseId: plan.enterprise,
      applicationId: plan.application,
      poolId: plan.pool,
      code: plan.code,
      publicSlug: plan.publicSlug,
      name: plan.name,
      state: 'ready',
      publicationState: 'draft',
    });
  }
}

function stableId(prefix: string, source: string): string {
  return `${prefix}:${createHash('sha256').update(source).digest('hex').slice(0, 32)}`;
}
