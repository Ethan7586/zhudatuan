import type { ReadCockpit } from '../../feature/cockpit/application/ReadCockpit';
import type { CockpitPort } from '../../feature/cockpit/public';
import type { ReadControl } from '../../feature/control/application/ReadControl';
import type { ControlPort } from '../../feature/control/public';
import type { CopyApplication } from '../../feature/experience/application/CopyApplication';
import type { CreateApplication } from '../../feature/experience/application/CreateApplication';
import type { PublishVersion } from '../../feature/experience/application/PublishVersion';
import type { ReadApplication } from '../../feature/experience/application/ReadApplication';
import type { ReadApplications } from '../../feature/experience/application/ReadApplications';
import type { ReadMallParents } from '../../feature/experience/application/ReadMallParents';
import type { RestoreVersion } from '../../feature/experience/application/RestoreVersion';
import type { SaveVersion } from '../../feature/experience/application/SaveVersion';
import type { UpdateMall } from '../../feature/experience/application/UpdateMall';
import type { ValidateVersion } from '../../feature/experience/application/ValidateVersion';
import type { ExperiencePort, MallDraftPort, MallPort } from '../../feature/experience/public';
import type { CreateFinanceImport } from '../../feature/finance/application/CreateFinanceImport';
import type { ExecuteFinanceAction } from '../../feature/finance/application/ExecuteFinanceAction';
import type { ManagePolicy } from '../../feature/finance/application/ManagePolicy';
import type { ManageReconciliation } from '../../feature/finance/application/ManageReconciliation';
import type { ManageRepair } from '../../feature/finance/application/ManageRepair';
import type { PreviewPolicy } from '../../feature/finance/application/PreviewPolicy';
import type { ReadFacets } from '../../feature/finance/application/ReadFacets';
import type { ReadFinanceAudit } from '../../feature/finance/application/ReadFinanceAudit';
import type { ReadFinanceImport } from '../../feature/finance/application/ReadFinanceImport';
import type { ReadFinanceImportProviders } from '../../feature/finance/application/ReadFinanceImportProviders';
import type { ReadOverview } from '../../feature/finance/application/ReadOverview';
import type { ReadPolicies } from '../../feature/finance/application/ReadPolicies';
import type { ReadReconciliations } from '../../feature/finance/application/ReadReconciliations';
import type { ReadRepairs } from '../../feature/finance/application/ReadRepairs';
import type { ReadSection } from '../../feature/finance/application/ReadSection';
import type { FinancePort } from '../../feature/finance/public';
import type { ApplyAfterSaleDecision } from '../../feature/order/application/ApplyAfterSaleDecision';
import type { CancelOrder } from '../../feature/order/application/CancelOrder';
import type { CreateOrderExport } from '../../feature/order/application/CreateOrderExport';
import type { CreateOrderImport } from '../../feature/order/application/CreateOrderImport';
import type { CreateReminder } from '../../feature/order/application/CreateReminder';
import type { InspectReturn } from '../../feature/order/application/InspectReturn';
import type { ReadAftersales } from '../../feature/order/application/ReadAftersales';
import type { ReadOrder } from '../../feature/order/application/ReadOrder';
import type { ReadOrders } from '../../feature/order/application/ReadOrders';
import type { ReadOrderSupport } from '../../feature/order/application/ReadOrderSupport';
import type { ReadRecoveries } from '../../feature/order/application/ReadRecoveries';
import type { ReceiveOrder } from '../../feature/order/application/ReceiveOrder';
import type { ReceiveReturn } from '../../feature/order/application/ReceiveReturn';
import type { RefundOrder } from '../../feature/order/application/RefundOrder';
import type { ResolveRecovery } from '../../feature/order/application/ResolveRecovery';
import type { ShipOrder } from '../../feature/order/application/ShipOrder';
import type { OrderPort } from '../../feature/order/public';
import type { CancelTask } from '../../feature/task/application/CancelTask';
import type { ConfirmImport } from '../../feature/task/application/ConfirmImport';
import type { CreateImport } from '../../feature/task/application/CreateImport';
import type { ReadImportProviders } from '../../feature/task/application/ReadImportProviders';
import type { ReadTasks } from '../../feature/task/application/ReadTasks';
import type { RetryTask } from '../../feature/task/application/RetryTask';
import type { TaskPort } from '../../feature/task/public';
import type { PreferencePort } from '../../shared/preference/PreferencePort';
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
