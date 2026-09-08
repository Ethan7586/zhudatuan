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

export interface CockpitDependencies {
  readonly port: CockpitPort;
  readonly read: ReadCockpit;
}
export interface ControlDependencies {
  readonly port: ControlPort;
  readonly read: ReadControl;
}
export interface OrderDependencies {
  readonly port: OrderPort;
  readonly readList: ReadOrders;
  readonly readDetail: ReadOrder;
  readonly readSupport: ReadOrderSupport;
  readonly readRecoveries: ReadRecoveries;
  readonly readAftersales: ReadAftersales;
  readonly createImport: CreateOrderImport;
  readonly createExport: CreateOrderExport;
  readonly receive: ReceiveOrder;
  readonly cancel: CancelOrder;
  readonly remind: CreateReminder;
  readonly decideAftersale: ApplyAfterSaleDecision;
  readonly ship: ShipOrder;
  readonly receiveReturn: ReceiveReturn;
  readonly inspectReturn: InspectReturn;
  readonly refund: RefundOrder;
  readonly resolveRecovery: ResolveRecovery;
  readonly importTemplate: ImportRegistration;
  readonly preferences: PreferencePort;
  readonly createIdentity: () => string;
}
export interface ExperienceDependencies {
  readonly port: ExperiencePort;
  readonly malls: MallPort;
  readonly drafts: MallDraftPort;
  readonly readList: ReadApplications;
  readonly readDetail: ReadApplication;
  readonly readMallParents: ReadMallParents;
  readonly createApplication: CreateApplication;
  readonly copy: CopyApplication;
  readonly updateMall: UpdateMall;
  readonly save: SaveVersion;
  readonly validate: ValidateVersion;
  readonly publish: PublishVersion;
  readonly restore: RestoreVersion;
  readonly createIdentity: () => string;
}
export interface FinanceDependencies {
  readonly port: FinancePort;
  readonly readOverview: ReadOverview;
  readonly readFacets: ReadFacets;
  readonly readAudit: ReadFinanceAudit;
  readonly readSection: ReadSection;
  readonly readReconciliations: ReadReconciliations;
  readonly manageReconciliation: ManageReconciliation;
  readonly execute: ExecuteFinanceAction;
  readonly createImport: CreateFinanceImport;
  readonly readImport: ReadFinanceImport;
  readonly readImportProviders: ReadFinanceImportProviders;
  readonly readPolicies: ReadPolicies;
  readonly readRepairs: ReadRepairs;
  readonly previewPolicy: PreviewPolicy;
  readonly managePolicy: ManagePolicy;
  readonly manageRepair: ManageRepair;
  readonly createIdentity: () => string;
}
export interface TaskDependencies {
  readonly registry: ImportRegistryPort;
  readonly port: TaskPort;
  readonly list: ReadTasks;
  readonly readProviders: ReadImportProviders;
  readonly cancel: CancelTask;
  readonly confirm: ConfirmImport;
  readonly createImport: CreateImport;
  readonly retry: RetryTask;
  readonly createIdentity: () => string;
}

export interface CoreDependencies {
  readonly cockpit: CockpitDependencies;
  readonly control: ControlDependencies;
  readonly experience: ExperienceDependencies;
  readonly finance: FinanceDependencies;
  readonly order: OrderDependencies;
  readonly product: ProductDependencies;
  readonly task: TaskDependencies;
}
