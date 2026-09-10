import { createIdempotencyKey } from '@shop/sdk/context';
import { CreateFinanceImport } from '../../feature/finance/application/CreateFinanceImport';
import { ExecuteFinanceAction } from '../../feature/finance/application/ExecuteFinanceAction';
import { ManagePolicy } from '../../feature/finance/application/ManagePolicy';
import { ManageReconciliation } from '../../feature/finance/application/ManageReconciliation';
import { ManageRepair } from '../../feature/finance/application/ManageRepair';
import { PreviewPolicy } from '../../feature/finance/application/PreviewPolicy';
import { ReadFacets } from '../../feature/finance/application/ReadFacets';
import { ReadFinanceAudit } from '../../feature/finance/application/ReadFinanceAudit';
import { ReadFinanceImport } from '../../feature/finance/application/ReadFinanceImport';
import { ReadFinanceImportProviders } from '../../feature/finance/application/ReadFinanceImportProviders';
import { ReadOverview } from '../../feature/finance/application/ReadOverview';
import { ReadPolicies } from '../../feature/finance/application/ReadPolicies';
import { ReadReconciliations } from '../../feature/finance/application/ReadReconciliations';
import { ReadRepairs } from '../../feature/finance/application/ReadRepairs';
import { ReadSection } from '../../feature/finance/application/ReadSection';
import type { FinancePort } from '../../feature/finance/public';
import { appConfig } from '../../shared/config/AppConfig';
import type { FinanceDependencies } from './CoreDependency';
import { lazyPort } from './LazyPort';

export function createFinanceDependencies(): FinanceDependencies {
  const port = lazyPort<FinancePort>(() => import('../../feature/finance/infrastructure/FinanceGateway').then(({ FinanceGateway }) => new FinanceGateway(appConfig.apiBaseUrl)));
  return Object.freeze({
    port,
    readOverview: new ReadOverview(port),
    readFacets: new ReadFacets(port),
    readAudit: new ReadFinanceAudit(port),
    readSection: new ReadSection(port),
    readReconciliations: new ReadReconciliations(port),
    manageReconciliation: new ManageReconciliation(port),
    execute: new ExecuteFinanceAction(port),
    createImport: new CreateFinanceImport(port),
    readImport: new ReadFinanceImport(port),
    readImportProviders: new ReadFinanceImportProviders(port),
    readPolicies: new ReadPolicies(port),
    readRepairs: new ReadRepairs(port),
    previewPolicy: new PreviewPolicy(port),
    managePolicy: new ManagePolicy(port),
    manageRepair: new ManageRepair(port),
    createIdentity: createIdempotencyKey,
  });
}
