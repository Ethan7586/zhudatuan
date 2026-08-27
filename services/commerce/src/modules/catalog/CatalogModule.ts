import { defineModule } from '../../bootstrap/DefinedModule';
import { catalogOperations } from './CatalogOperations';
import { PgCatalogSku } from './infrastructure/persistence/PgCatalogSku';
export { ApplyRiskDecision } from './application/command/ApplyRiskDecision';
export type { CatalogSku } from './application/port/CatalogSku';
export const catalogSku = new PgCatalogSku();
export { CatalogSourcePort, catalogSourcePort, type CatalogSourceInput } from './CatalogSourcePort';
export const CatalogModule = defineModule('catalog', ['partner'], catalogOperations);
