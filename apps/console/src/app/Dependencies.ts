import { NAVIGATION_CATALOG_HASH } from '../generated/NavigationBinding';
import { CancelSync } from '../feature/channel/application/CancelSync';
import { CreateConnection } from '../feature/channel/application/CreateConnection';
import { DisableConnection } from '../feature/channel/application/DisableConnection';
import { EnableConnection } from '../feature/channel/application/EnableConnection';
import { ReadChannels } from '../feature/channel/application/ReadChannels';
import { ReplayOperation } from '../feature/channel/application/ReplayOperation';
import { StartSync } from '../feature/channel/application/StartSync';
import { TestConnection } from '../feature/channel/application/TestConnection';
import { UpdateConnection } from '../feature/channel/application/UpdateConnection';
import { ChannelGateway } from '../feature/channel/infrastructure/ChannelGateway';
import type { ChannelPort } from '../feature/channel/public';
import { ReadCockpit } from '../feature/cockpit/application/ReadCockpit';
import { CockpitGateway } from '../feature/cockpit/infrastructure/CockpitGateway';
import type { CockpitPort } from '../feature/cockpit/public';
import { CopyApplication } from '../feature/experience/application/CopyApplication';
import { CreateApplication } from '../feature/experience/application/CreateApplication';
import { PublishVersion } from '../feature/experience/application/PublishVersion';
import { ReadApplication } from '../feature/experience/application/ReadApplication';
import { ReadApplications } from '../feature/experience/application/ReadApplications';
import { RestoreVersion } from '../feature/experience/application/RestoreVersion';
import { SaveVersion } from '../feature/experience/application/SaveVersion';
import { UpdateApplication } from '../feature/experience/application/UpdateApplication';
import { ValidateVersion } from '../feature/experience/application/ValidateVersion';
import { ExperienceGateway } from '../feature/experience/infrastructure/ExperienceGateway';
import type { ExperiencePort } from '../feature/experience/public';
import { ReadOverview } from '../feature/finance/application/ReadOverview';
import { ReadReconciliations } from '../feature/finance/application/ReadReconciliations';
import { ReadSection } from '../feature/finance/application/ReadSection';
import { FinanceGateway } from '../feature/finance/infrastructure/FinanceGateway';
import type { FinancePort } from '../feature/finance/public';
import { ReadAftersales } from '../feature/order/application/ReadAftersales';
import { ReadOrder } from '../feature/order/application/ReadOrder';
import { ReadOrders } from '../feature/order/application/ReadOrders';
import { OrderGateway } from '../feature/order/infrastructure/OrderGateway';
import type { OrderPort } from '../feature/order/public';
import { ChangePool } from '../feature/product/application/ChangePool';
import { ChangePublication } from '../feature/product/application/ChangePublication';
import { ExecuteProductAction } from '../feature/product/application/ProductActions';
import { ReadProduct } from '../feature/product/application/ReadProduct';
import { ReadProducts } from '../feature/product/application/ReadProducts';
import { ReadPools } from '../feature/product/application/ReadPools';
import { ProductGateway } from '../feature/product/infrastructure/ProductGateway';
import { ExportReport } from '../feature/reporting/application/ExportReport';
import { ReadExport } from '../feature/reporting/application/ReadExport';
import { ReadReport } from '../feature/reporting/application/ReadReport';
import { ReportingGateway } from '../feature/reporting/infrastructure/ReportingGateway';
import type { ReportingPort } from '../feature/reporting/public';
import { AssignTicket } from '../feature/support/application/AssignTicket';
import { CloseTicket } from '../feature/support/application/CloseTicket';
import { ManageSupportConfig } from '../feature/support/application/ManageSupportConfig';
import { ReadConversation } from '../feature/support/application/ReadConversation';
import { ReadQueue } from '../feature/support/application/ReadQueue';
import { ReopenTicket } from '../feature/support/application/ReopenTicket';
import { SendMessage } from '../feature/support/application/SendMessage';
import { UpdateReadState } from '../feature/support/application/UpdateReadState';
import { UploadAttachment } from '../feature/support/application/UploadAttachment';
import { SupportGateway } from '../feature/support/infrastructure/SupportGateway';
import type { SupportPort } from '../feature/support/public';
import { AllocateCardLibrary } from '../feature/voucher/application/AllocateCardLibrary';
import { BindVoucher } from '../feature/voucher/application/BindVoucher';
import { ChangeVoucherStatus } from '../feature/voucher/application/ChangeVoucherStatus';
import { CreateCardLibrary } from '../feature/voucher/application/CreateCardLibrary';
import { DecideVoucherReserve } from '../feature/voucher/application/DecideVoucherReserve';
import { IssueVoucherBatch } from '../feature/voucher/application/IssueVoucherBatch';
import { ReadVouchers } from '../feature/voucher/application/ReadVouchers';
import { RequestVoucherReserve } from '../feature/voucher/application/RequestVoucherReserve';
import { RetryVoucherBatch } from '../feature/voucher/application/RetryVoucherBatch';
import { ReverseVoucherRedemption } from '../feature/voucher/application/ReverseVoucherRedemption';
import { SaveVoucherProgram } from '../feature/voucher/application/SaveVoucherProgram';
import { VoucherGateway } from '../feature/voucher/infrastructure/VoucherGateway';
import type { VoucherPort } from '../feature/voucher/public';
import { appConfig } from '../shared/config/AppConfig';
import { createIdempotencyKey } from '@shop/sdk/context';

export interface ProductDependencies {
  readonly gateway: ProductGateway;
  readonly readProducts: ReadProducts;
  readonly readProduct: ReadProduct;
  readonly readPools: ReadPools;
  readonly changePublication: ChangePublication;
  readonly changePool: ChangePool;
  readonly executeAction: ExecuteProductAction;
}

export interface CockpitDependencies { readonly port: CockpitPort; readonly read: ReadCockpit }
export interface OrderDependencies { readonly port: OrderPort; readonly readList: ReadOrders; readonly readDetail: ReadOrder; readonly readAftersales: ReadAftersales }
export interface ExperienceDependencies { readonly port: ExperiencePort; readonly readList: ReadApplications; readonly readDetail: ReadApplication; readonly create: CreateApplication; readonly copy: CopyApplication; readonly update: UpdateApplication; readonly save: SaveVersion; readonly validate: ValidateVersion; readonly publish: PublishVersion; readonly restore: RestoreVersion; readonly createIdentity: () => string }
export interface FinanceDependencies { readonly port: FinancePort; readonly readOverview: ReadOverview; readonly readSection: ReadSection; readonly readReconciliations: ReadReconciliations }

export interface ChannelDependencies {
  readonly port: ChannelPort;
  readonly read: ReadChannels;
  readonly create: CreateConnection;
  readonly update: UpdateConnection;
  readonly test: TestConnection;
  readonly enable: EnableConnection;
  readonly disable: DisableConnection;
  readonly startSync: StartSync;
  readonly cancelSync: CancelSync;
  readonly replay: ReplayOperation;
  readonly createIdentity: () => string;
}

export interface SupportDependencies {
  readonly port: SupportPort;
  readonly readQueue: ReadQueue;
  readonly readConversation: ReadConversation;
  readonly sendMessage: SendMessage;
  readonly uploadAttachment: UploadAttachment;
  readonly assignTicket: AssignTicket;
  readonly closeTicket: CloseTicket;
  readonly reopenTicket: ReopenTicket;
  readonly updateReadState: UpdateReadState;
  readonly manageConfig: ManageSupportConfig;
}

export interface ReportingDependencies {
  readonly port: ReportingPort;
  readonly read: ReadReport;
  readonly export: ExportReport;
  readonly readExport: ReadExport;
  readonly createIdentity: () => string;
}

export interface VoucherDependencies {
  readonly createIdentity: () => string;
  readonly port: VoucherPort;
  readonly read: ReadVouchers;
  readonly createLibrary: CreateCardLibrary;
  readonly allocateLibrary: AllocateCardLibrary;
  readonly saveProgram: SaveVoucherProgram;
  readonly requestReserve: RequestVoucherReserve;
  readonly decideReserve: DecideVoucherReserve;
  readonly issueBatch: IssueVoucherBatch;
  readonly retryBatch: RetryVoucherBatch;
  readonly changeStatus: ChangeVoucherStatus;
  readonly bind: BindVoucher;
  readonly reverse: ReverseVoucherRedemption;
}

export interface ConsoleDependencies { readonly channel: ChannelDependencies; readonly cockpit: CockpitDependencies; readonly experience: ExperienceDependencies; readonly finance: FinanceDependencies; readonly order: OrderDependencies; readonly product: ProductDependencies; readonly reporting: ReportingDependencies; readonly support: SupportDependencies; readonly voucher: VoucherDependencies }

export function createConsoleDependencies(): ConsoleDependencies {
  const gateway = new ProductGateway({ apiBaseUrl: appConfig.apiBaseUrl, clientVersion: appConfig.clientVersion, catalogVersion: NAVIGATION_CATALOG_HASH });
  const cockpit = new CockpitGateway(appConfig.apiBaseUrl);
  const channel = new ChannelGateway(appConfig.apiBaseUrl);
  const experience = new ExperienceGateway(appConfig.apiBaseUrl);
  const finance = new FinanceGateway(appConfig.apiBaseUrl);
  const support = new SupportGateway({ apiBaseUrl: appConfig.apiBaseUrl });
  const voucher = new VoucherGateway(appConfig.apiBaseUrl);
  const reporting = new ReportingGateway(appConfig.apiBaseUrl);
  const order = new OrderGateway(appConfig.apiBaseUrl);
  return Object.freeze({
    channel: Object.freeze({ port: channel, read: new ReadChannels(channel), create: new CreateConnection(channel), update: new UpdateConnection(channel), test: new TestConnection(channel), enable: new EnableConnection(channel), disable: new DisableConnection(channel), startSync: new StartSync(channel), cancelSync: new CancelSync(channel), replay: new ReplayOperation(channel), createIdentity: createIdempotencyKey }),
    cockpit: Object.freeze({ port: cockpit, read: new ReadCockpit(cockpit) }),
    experience: Object.freeze({ port: experience, readList: new ReadApplications(experience), readDetail: new ReadApplication(experience), create: new CreateApplication(experience), copy: new CopyApplication(experience), update: new UpdateApplication(experience), save: new SaveVersion(experience), validate: new ValidateVersion(experience), publish: new PublishVersion(experience), restore: new RestoreVersion(experience), createIdentity: createIdempotencyKey }),
    finance: Object.freeze({ port: finance, readOverview: new ReadOverview(finance), readSection: new ReadSection(finance), readReconciliations: new ReadReconciliations(finance) }),
    order: Object.freeze({ port: order, readList: new ReadOrders(order), readDetail: new ReadOrder(order), readAftersales: new ReadAftersales(order) }),
    product: Object.freeze({ gateway, readProducts: new ReadProducts(gateway), readProduct: new ReadProduct(gateway), readPools: new ReadPools(gateway), changePublication: new ChangePublication(gateway), changePool: new ChangePool(gateway), executeAction: new ExecuteProductAction(gateway) }),
    reporting: Object.freeze({ port: reporting, read: new ReadReport(reporting), export: new ExportReport(reporting), readExport: new ReadExport(reporting), createIdentity: createIdempotencyKey }),
    support: Object.freeze({
      port: support,
      readQueue: new ReadQueue(support),
      readConversation: new ReadConversation(support),
      sendMessage: new SendMessage(support),
      uploadAttachment: new UploadAttachment(support),
      assignTicket: new AssignTicket(support),
      closeTicket: new CloseTicket(support),
      reopenTicket: new ReopenTicket(support),
      updateReadState: new UpdateReadState(support),
      manageConfig: new ManageSupportConfig(support),
    }),
    voucher: Object.freeze({
      createIdentity: createIdempotencyKey,
      port: voucher,
      read: new ReadVouchers(voucher),
      createLibrary: new CreateCardLibrary(voucher),
      allocateLibrary: new AllocateCardLibrary(voucher),
      saveProgram: new SaveVoucherProgram(voucher),
      requestReserve: new RequestVoucherReserve(voucher),
      decideReserve: new DecideVoucherReserve(voucher),
      issueBatch: new IssueVoucherBatch(voucher),
      retryBatch: new RetryVoucherBatch(voucher),
      changeStatus: new ChangeVoucherStatus(voucher),
      bind: new BindVoucher(voucher),
      reverse: new ReverseVoucherRedemption(voucher),
    }),
  });
}
