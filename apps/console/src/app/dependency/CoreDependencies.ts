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
import { UpdateApplication } from '../../feature/experience/application/UpdateApplication';
import { ValidateVersion } from '../../feature/experience/application/ValidateVersion';
import type { ExperiencePort } from '../../feature/experience/public';
import { ManageReconciliation } from '../../feature/finance/application/ManageReconciliation';
import { ReadOverview } from '../../feature/finance/application/ReadOverview';
import { ReadReconciliations } from '../../feature/finance/application/ReadReconciliations';
import { ReadSection } from '../../feature/finance/application/ReadSection';
import type { FinancePort } from '../../feature/finance/public';
import { ReadAftersales } from '../../feature/order/application/ReadAftersales';
import { ReadOrder } from '../../feature/order/application/ReadOrder';
import { ReadOrders } from '../../feature/order/application/ReadOrders';
import type { OrderPort } from '../../feature/order/public';
import { ChangePool } from '../../feature/product/application/ChangePool';
import { ChangePublication } from '../../feature/product/application/ChangePublication';
import { ExecuteProductAction } from '../../feature/product/application/ProductActions';
import { ReadPools } from '../../feature/product/application/ReadPools';
import { ReadProduct } from '../../feature/product/application/ReadProduct';
import { ReadProducts } from '../../feature/product/application/ReadProducts';
import type { ProductPort } from '../../feature/product/public';
import { ReadImportTask } from '../../feature/task/application/ReadImportTask';
import type { TaskPort } from '../../feature/task/public';
import { appConfig } from '../../shared/config/AppConfig';
import { createIdempotencyKey } from '@shop/sdk/context';
import { lazyPort } from './LazyPort';

export interface ProductDependencies {
  readonly gateway: ProductPort;
  readonly readProducts: ReadProducts;
  readonly readProduct: ReadProduct;
  readonly readPools: ReadPools;
  readonly changePublication: ChangePublication;
  readonly changePool: ChangePool;
  readonly executeAction: ExecuteProductAction;
}
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
  readonly readAftersales: ReadAftersales;
}
export interface ExperienceDependencies {
  readonly port: ExperiencePort;
  readonly readList: ReadApplications;
  readonly readDetail: ReadApplication;
  readonly create: CreateApplication;
  readonly copy: CopyApplication;
  readonly update: UpdateApplication;
  readonly save: SaveVersion;
  readonly validate: ValidateVersion;
  readonly publish: PublishVersion;
  readonly restore: RestoreVersion;
  readonly createIdentity: () => string;
}
export interface FinanceDependencies {
  readonly port: FinancePort;
  readonly readOverview: ReadOverview;
  readonly readSection: ReadSection;
  readonly readReconciliations: ReadReconciliations;
  readonly manageReconciliation: ManageReconciliation;
  readonly createIdentity: () => string;
}
export interface TaskDependencies {
  readonly port: TaskPort;
  readonly read: ReadImportTask;
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

export function createCoreDependencies(): CoreDependencies {
  const cockpit = lazyPort<CockpitPort>(() => import('../../feature/cockpit/infrastructure/CockpitGateway').then(({ CockpitGateway }) => new CockpitGateway(appConfig.apiBaseUrl)));
  const control = lazyPort<ControlPort>(() => import('../../feature/control/infrastructure/ControlGateway').then(({ ControlGateway }) => new ControlGateway(appConfig.apiBaseUrl)));
  const experience = lazyPort<ExperiencePort>(() => import('../../feature/experience/infrastructure/ExperienceGateway').then(({ ExperienceGateway }) => new ExperienceGateway(appConfig.apiBaseUrl)));
  const finance = lazyPort<FinancePort>(() => import('../../feature/finance/infrastructure/FinanceGateway').then(({ FinanceGateway }) => new FinanceGateway(appConfig.apiBaseUrl)));
  const order = lazyPort<OrderPort>(() => import('../../feature/order/infrastructure/OrderGateway').then(({ OrderGateway }) => new OrderGateway(appConfig.apiBaseUrl)));
  const product = lazyPort<ProductPort>(() =>
    import('../../feature/product/infrastructure/ProductGateway').then(({ ProductGateway }) => new ProductGateway({ apiBaseUrl: appConfig.apiBaseUrl, clientVersion: appConfig.clientVersion, catalogVersion: NAVIGATION_CATALOG_HASH }))
  );
  const task = lazyPort<TaskPort>(() => import('../../feature/task/infrastructure/TaskGateway').then(({ TaskGateway }) => new TaskGateway(appConfig.apiBaseUrl)));
  return Object.freeze({
    cockpit: Object.freeze({ port: cockpit, read: new ReadCockpit(cockpit) }),
    control: Object.freeze({ port: control, read: new ReadControl(control) }),
    experience: Object.freeze({
      port: experience,
      readList: new ReadApplications(experience),
      readDetail: new ReadApplication(experience),
      create: new CreateApplication(experience),
      copy: new CopyApplication(experience),
      update: new UpdateApplication(experience),
      save: new SaveVersion(experience),
      validate: new ValidateVersion(experience),
      publish: new PublishVersion(experience),
      restore: new RestoreVersion(experience),
      createIdentity: createIdempotencyKey,
    }),
    finance: Object.freeze({
      port: finance,
      readOverview: new ReadOverview(finance),
      readSection: new ReadSection(finance),
      readReconciliations: new ReadReconciliations(finance),
      manageReconciliation: new ManageReconciliation(finance),
      createIdentity: createIdempotencyKey,
    }),
    order: Object.freeze({ port: order, readList: new ReadOrders(order), readDetail: new ReadOrder(order), readAftersales: new ReadAftersales(order) }),
    product: Object.freeze({
      gateway: product,
      readProducts: new ReadProducts(product),
      readProduct: new ReadProduct(product),
      readPools: new ReadPools(product),
      changePublication: new ChangePublication(product),
      changePool: new ChangePool(product),
      executeAction: new ExecuteProductAction(product),
    }),
    task: Object.freeze({ port: task, read: new ReadImportTask(task) }),
  });
}
