import { defineModule } from '../../../bootstrap/DefinedModule';
import { catalogOperations } from '../03_application_yingyong/CatalogOperations';
import { PgCatalogSku } from '../04_adapters_shixian/persistence/PgCatalogSku';
export { ApplyRiskDecision } from '../03_application_yingyong/command/ApplyRiskDecision';
export type { CatalogSku } from '../03_application_yingyong/port/CatalogSku';
export const catalogSku = new PgCatalogSku();
export { CatalogSourcePort, catalogSourcePort, type CatalogSourceInput } from '../01_public_gongkai/CatalogSourcePort';
export { CatalogProvisioningPort, catalogProvisioningPort } from '../01_public_gongkai/CatalogProvisioningPort';
export const CatalogModule = defineModule('catalog', ['partner'], catalogOperations);
