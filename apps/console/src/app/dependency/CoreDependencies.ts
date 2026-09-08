import { NAVIGATION_CATALOG_HASH } from '../../generated/NavigationBinding';
import { ReadCockpit } from '../../feature/cockpit/application/ReadCockpit';
import type { CockpitPort } from '../../feature/cockpit/public';
import { ReadControl } from '../../feature/control/application/ReadControl';
import type { ControlPort } from '../../feature/control/public';
import { CopyApplication } from '../../feature/experience/application/CopyApplication';
import { CreateApplication } from '../../feature/experience/application/CreateApplication';
import { PublishVersion } from '../../feature/experience/application/PublishVersion';
import { ReadApplication } from '../../feature/experience/application/ReadApplication';
import { ReadApplications } from '../../feature/experience/application/ReadApplications';
import { RestoreVersion } from '../../feature/experience/application/RestoreVersion';
import { SaveVersion } from '../../feature/experience/application/SaveVersion';
import { UpdateMall } from '../../feature/experience/application/UpdateMall';
import { ValidateVersion } from '../../feature/experience/application/ValidateVersion';
import { ReadMallParents } from '../../feature/experience/application/ReadMallParents';
import { MallDraftStore } from '../../feature/experience/infrastructure/MallDraftStore';
import type { ExperiencePort, MallDraftPort, MallPort } from '../../feature/experience/public';
import { ManageReconciliation } from '../../feature/finance/application/ManageReconciliation';
import { ExecuteFinanceAction } from '../../feature/finance/application/ExecuteFinanceAction';
import { ReadOverview } from '../../feature/finance/application/ReadOverview';
import { ReadFacets } from '../../feature/finance/application/ReadFacets';
import { ReadFinanceAudit } from '../../feature/finance/application/ReadFinanceAudit';
import { ReadReconciliations } from '../../feature/finance/application/ReadReconciliations';
import { ReadSection } from '../../feature/finance/application/ReadSection';
import { CreateFinanceImport } from '../../feature/finance/application/CreateFinanceImport';
import { ReadFinanceImport } from '../../feature/finance/application/ReadFinanceImport';
import { ReadFinanceImportProviders } from '../../feature/finance/application/ReadFinanceImportProviders';
import { ReadPolicies } from '../../feature/finance/application/ReadPolicies';
import { ReadRepairs } from '../../feature/finance/application/ReadRepairs';
import { PreviewPolicy } from '../../feature/finance/application/PreviewPolicy';
import { ManagePolicy } from '../../feature/finance/application/ManagePolicy';
import { ManageRepair } from '../../feature/finance/application/ManageRepair';
import type { FinancePort } from '../../feature/finance/public';
import { ReadAftersales } from '../../feature/order/application/ReadAftersales';
import { ApplyAfterSaleDecision } from '../../feature/order/application/ApplyAfterSaleDecision';
import { CreateOrderExport } from '../../feature/order/application/CreateOrderExport';
import { CreateOrderImport } from '../../feature/order/application/CreateOrderImport';
import { CreateReminder } from '../../feature/order/application/CreateReminder';
import { ReadOrder } from '../../feature/order/application/ReadOrder';
import { ReadOrderSupport } from '../../feature/order/application/ReadOrderSupport';
import { ReadRecoveries } from '../../feature/order/application/ReadRecoveries';
import { ReadOrders } from '../../feature/order/application/ReadOrders';
import { ReceiveOrder } from '../../feature/order/application/ReceiveOrder';
import { CancelOrder } from '../../feature/order/application/CancelOrder';
import { ShipOrder } from '../../feature/order/application/ShipOrder';
import { ReceiveReturn } from '../../feature/order/application/ReceiveReturn';
import { InspectReturn } from '../../feature/order/application/InspectReturn';
import { RefundOrder } from '../../feature/order/application/RefundOrder';
import { ResolveRecovery } from '../../feature/order/application/ResolveRecovery';
import type { OrderPort } from '../../feature/order/public';
import { ChangePool } from '../../feature/product/application/ChangePool';
import { ChangePublication } from '../../feature/product/application/ChangePublication';
import { ConfirmProductImport } from '../../feature/product/application/ConfirmProductImport';
import { CreateProductImport } from '../../feature/product/application/CreateProductImport';
import { ExecuteProductBatch } from '../../feature/product/application/ExecuteProductBatch';
import { ExecuteProductAction } from '../../feature/product/application/ProductActions';
import { PreviewProductBatch } from '../../feature/product/application/PreviewProductBatch';
import { ReadProductImport } from '../../feature/product/application/ReadProductImport';
import { ReadPools } from '../../feature/product/application/ReadPools';
import { ReadFacets as ReadProductFacets } from '../../feature/product/application/ReadFacets';
import { ReadProduct } from '../../feature/product/application/ReadProduct';
import { ReadProducts } from '../../feature/product/application/ReadProducts';
import type { ProductImportPort, ProductPort } from '../../feature/product/public';
import { CancelTask } from '../../feature/task/application/CancelTask';
import { ConfirmImport } from '../../feature/task/application/ConfirmImport';
import { CreateImport } from '../../feature/task/application/CreateImport';
import { ReadTasks } from '../../feature/task/application/ReadTasks';
import { ReadImportProviders } from '../../feature/task/application/ReadImportProviders';
import { RetryTask } from '../../feature/task/application/RetryTask';
import type { TaskPort } from '../../feature/task/public';
import { appConfig } from '../../shared/config/AppConfig';
import { BrowserPreference } from '../../shared/preference/BrowserPreference';
import type { PreferencePort } from '../../shared/preference/PreferencePort';
import { createIdempotencyKey } from '@shop/sdk/context';
import { lazyPort } from './LazyPort';
import type { ImportRegistration, ImportRegistryPort } from '../registry/ImportRegistry';
import type { ProductDependencies } from './ProductDependencies';
export type { ProductDependencies } from './ProductDependencies';
import type { CoreDependencies } from './CoreDependency';
export * from './CoreDependency';

export function createCoreDependencies(imports: ImportRegistryPort): CoreDependencies {
  const cockpit = lazyPort<CockpitPort>(() => import('../../feature/cockpit/infrastructure/CockpitGateway').then(({ CockpitGateway }) => new CockpitGateway(appConfig.apiBaseUrl)));
  const control = lazyPort<ControlPort>(() => import('../../feature/control/infrastructure/ControlGateway').then(({ ControlGateway }) => new ControlGateway(appConfig.apiBaseUrl)));
  const experience = lazyPort<ExperiencePort>(() => import('../../feature/experience/infrastructure/ExperienceGateway').then(({ ExperienceGateway }) => new ExperienceGateway(appConfig.apiBaseUrl)));
  const malls = lazyPort<MallPort>(() => import('../../feature/experience/infrastructure/MallGateway').then(({ MallGateway }) => new MallGateway(appConfig.apiBaseUrl)));
  const drafts = new MallDraftStore();
  const finance = lazyPort<FinancePort>(() => import('../../feature/finance/infrastructure/FinanceGateway').then(({ FinanceGateway }) => new FinanceGateway(appConfig.apiBaseUrl)));
  const order = lazyPort<OrderPort>(() => import('../../feature/order/infrastructure/OrderGateway').then(({ OrderGateway }) => new OrderGateway(appConfig.apiBaseUrl)));
  const product = lazyPort<ProductPort & ProductImportPort>(() =>
    import('../../feature/product/infrastructure/ProductGateway').then(({ ProductGateway }) => new ProductGateway({ apiBaseUrl: appConfig.apiBaseUrl, clientVersion: appConfig.clientVersion, catalogVersion: NAVIGATION_CATALOG_HASH }))
  );
  const task = lazyPort<TaskPort>(() => import('../../feature/task/infrastructure/TaskGateway').then(({ TaskGateway }) => new TaskGateway(appConfig.apiBaseUrl)));
  const preferences = new BrowserPreference();
  return Object.freeze({
    cockpit: Object.freeze({ port: cockpit, read: new ReadCockpit(cockpit) }),
    control: Object.freeze({ port: control, read: new ReadControl(control) }),
    experience: Object.freeze({
      port: experience,
      malls,
      drafts,
      readList: new ReadApplications(experience),
      readDetail: new ReadApplication(experience),
      readMallParents: new ReadMallParents(malls),
      createApplication: new CreateApplication(malls),
      copy: new CopyApplication(experience),
      updateMall: new UpdateMall(malls),
      save: new SaveVersion(experience),
      validate: new ValidateVersion(experience),
      publish: new PublishVersion(experience),
      restore: new RestoreVersion(experience),
      createIdentity: createIdempotencyKey,
    }),
    finance: Object.freeze({
      port: finance,
      readOverview: new ReadOverview(finance),
      readFacets: new ReadFacets(finance),
      readAudit: new ReadFinanceAudit(finance),
      readSection: new ReadSection(finance),
      readReconciliations: new ReadReconciliations(finance),
      manageReconciliation: new ManageReconciliation(finance),
      execute: new ExecuteFinanceAction(finance),
      createImport: new CreateFinanceImport(finance),
      readImport: new ReadFinanceImport(finance),
      readImportProviders: new ReadFinanceImportProviders(finance),
      readPolicies: new ReadPolicies(finance),
      readRepairs: new ReadRepairs(finance),
      previewPolicy: new PreviewPolicy(finance),
      managePolicy: new ManagePolicy(finance),
      manageRepair: new ManageRepair(finance),
      createIdentity: createIdempotencyKey,
    }),
    order: Object.freeze({
      port: order,
      readList: new ReadOrders(order),
      readDetail: new ReadOrder(order),
      readSupport: new ReadOrderSupport(order),
      readRecoveries: new ReadRecoveries(order),
      readAftersales: new ReadAftersales(order),
      createImport: new CreateOrderImport(order),
      createExport: new CreateOrderExport(order),
      receive: new ReceiveOrder(order),
      cancel: new CancelOrder(order),
      remind: new CreateReminder(order),
      decideAftersale: new ApplyAfterSaleDecision(order),
      ship: new ShipOrder(order),
      receiveReturn: new ReceiveReturn(order),
      inspectReturn: new InspectReturn(order),
      refund: new RefundOrder(order),
      resolveRecovery: new ResolveRecovery(order),
      importTemplate: imports.get('order'),
      preferences,
      createIdentity: createIdempotencyKey,
    }),
    product: Object.freeze({
      gateway: product,
      readProducts: new ReadProducts(product),
      readProduct: new ReadProduct(product),
      readPools: new ReadPools(product),
      readFacets: new ReadProductFacets(product),
      changePublication: new ChangePublication(product),
      previewBatch: new PreviewProductBatch(product),
      executeBatch: new ExecuteProductBatch(product),
      changePool: new ChangePool(product),
      executeAction: new ExecuteProductAction(product),
      createImport: new CreateProductImport(product),
      readImport: new ReadProductImport(product),
      confirmImport: new ConfirmProductImport(product),
      importTemplate: imports.get('catalog'),
      preferences,
      createIdentity: createIdempotencyKey,
    }),
    task: Object.freeze({
      registry: imports,
      port: task,
      list: new ReadTasks(task),
      readProviders: new ReadImportProviders(task),
      createImport: new CreateImport(task, imports),
      cancel: new CancelTask(task),
      confirm: new ConfirmImport(task),
      retry: new RetryTask(task),
      createIdentity: createIdempotencyKey,
    }),
  });
}
