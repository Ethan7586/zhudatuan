import { createIdempotencyKey } from '@shop/sdk/context';
import { DecideApprovalTask } from '../../feature/approval/application/DecideApprovalTask';
import { ManageApprovalTemplate } from '../../feature/approval/application/ManageApprovalTemplate';
import { ReadApprovalInstance } from '../../feature/approval/application/ReadApprovalInstance';
import { ReadApprovals } from '../../feature/approval/application/ReadApprovals';
import type { ApprovalPort } from '../../feature/approval/public';
import { CancelSync } from '../../feature/channel/application/CancelSync';
import { CreateConnection } from '../../feature/channel/application/CreateConnection';
import { DisableConnection } from '../../feature/channel/application/DisableConnection';
import { EnableConnection } from '../../feature/channel/application/EnableConnection';
import { ReadChannels } from '../../feature/channel/application/ReadChannels';
import { ReplayOperation } from '../../feature/channel/application/ReplayOperation';
import { StartSync } from '../../feature/channel/application/StartSync';
import { TestConnection } from '../../feature/channel/application/TestConnection';
import { UpdateConnection } from '../../feature/channel/application/UpdateConnection';
import type { ChannelPort } from '../../feature/channel/public';
import { CreateInvitation } from '../../feature/invitation/application/CreateInvitation';
import { ReadInvitations } from '../../feature/invitation/application/ReadInvitations';
import { ReadMemberships } from '../../feature/invitation/application/ReadMemberships';
import { RevokeInvitation } from '../../feature/invitation/application/RevokeInvitation';
import type { InvitationPort } from '../../feature/invitation/public';
import { ManageProduct } from '../../feature/referral/application/ManageProduct';
import { ManageSetting } from '../../feature/referral/application/ManageSetting';
import { PrepareReferral } from '../../feature/referral/application/PrepareReferral';
import { ReadReferral } from '../../feature/referral/application/ReadReferral';
import { ReviewMember } from '../../feature/referral/application/ReviewMember';
import type { ReferralPort } from '../../feature/referral/public';
import { ExportReport } from '../../feature/reporting/application/ExportReport';
import { ReadExport } from '../../feature/reporting/application/ReadExport';
import { ReadReport } from '../../feature/reporting/application/ReadReport';
import type { ReportingPort } from '../../feature/reporting/public';
import { AssignTicket } from '../../feature/support/application/AssignTicket';
import { CloseTicket } from '../../feature/support/application/CloseTicket';
import { ManageSupportConfig } from '../../feature/support/application/ManageSupportConfig';
import { ReadConversation } from '../../feature/support/application/ReadConversation';
import { ReadQueue } from '../../feature/support/application/ReadQueue';
import { ReopenTicket } from '../../feature/support/application/ReopenTicket';
import { SendMessage } from '../../feature/support/application/SendMessage';
import { UpdateReadState } from '../../feature/support/application/UpdateReadState';
import { UploadAttachment } from '../../feature/support/application/UploadAttachment';
import { SupportGateway } from '../../feature/support/infrastructure/SupportGateway';
import type { SupportPort } from '../../feature/support/public';
import { ExecuteVoucher } from '../../feature/voucher/application/ExecuteVoucher';
import { ReadVouchers } from '../../feature/voucher/application/ReadVouchers';
import type { VoucherPort } from '../../feature/voucher/public';
import { appConfig } from '../../shared/config/AppConfig';
import { lazyPort } from './LazyPort';
import type { ApprovalRegistryPort } from '../registry/ApprovalRegistry';
import type { ExtensionRegistryPort } from '../registry/ExtensionRegistry';

export interface ChannelDependencies {
  readonly registry: ExtensionRegistryPort;
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
export interface ApprovalDependencies {
  readonly registry: ApprovalRegistryPort;
  readonly port: ApprovalPort;
  readonly read: ReadApprovals;
  readonly readInstance: ReadApprovalInstance;
  readonly manage: ManageApprovalTemplate;
  readonly decide: DecideApprovalTask;
  readonly createIdentity: () => string;
}
export interface InvitationDependencies {
  readonly port: InvitationPort;
  readonly read: ReadInvitations;
  readonly memberships: ReadMemberships;
  readonly create: CreateInvitation;
  readonly revoke: RevokeInvitation;
  readonly createIdentity: () => string;
}
export interface ReferralDependencies {
  readonly port: ReferralPort;
  readonly read: ReadReferral;
  readonly manageSetting: ManageSetting;
  readonly manageProduct: ManageProduct;
  readonly reviewMember: ReviewMember;
  readonly prepare: PrepareReferral;
  readonly createIdentity: () => string;
}
export interface ReportingDependencies {
  readonly port: ReportingPort;
  readonly read: ReadReport;
  readonly export: ExportReport;
  readonly readExport: ReadExport;
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
export interface VoucherDependencies {
  readonly createIdentity: () => string;
  readonly port: VoucherPort;
  readonly read: ReadVouchers;
  readonly execute: ExecuteVoucher;
}

export interface ServiceDependencies {
  readonly approval: ApprovalDependencies;
  readonly channel: ChannelDependencies;
  readonly invitation: InvitationDependencies;
  readonly referral: ReferralDependencies;
  readonly reporting: ReportingDependencies;
  readonly support: SupportDependencies;
  readonly voucher: VoucherDependencies;
}

export function createServiceDependencies(approvals: ApprovalRegistryPort, extensions: ExtensionRegistryPort): ServiceDependencies {
  const approval = lazyPort<ApprovalPort>(() => import('../../feature/approval/infrastructure/ApprovalGateway').then(({ ApprovalGateway }) => new ApprovalGateway(appConfig.apiBaseUrl)));
  const channel = lazyPort<ChannelPort>(() => import('../../feature/channel/infrastructure/ChannelGateway').then(({ ChannelGateway }) => new ChannelGateway(appConfig.apiBaseUrl)));
  const invitation = lazyPort<InvitationPort>(() => import('../../feature/invitation/infrastructure/InvitationGateway').then(({ InvitationGateway }) => new InvitationGateway(appConfig.apiBaseUrl)));
  const referral = lazyPort<ReferralPort>(() => import('../../feature/referral/infrastructure/ReferralGateway').then(({ ReferralGateway }) => new ReferralGateway(appConfig.apiBaseUrl)));
  const reporting = lazyPort<ReportingPort>(() => import('../../feature/reporting/infrastructure/ReportingGateway').then(({ ReportingGateway }) => new ReportingGateway(appConfig.apiBaseUrl)));
  const support = new SupportGateway({ apiBaseUrl: appConfig.apiBaseUrl });
  const voucher = lazyPort<VoucherPort>(() => import('../../feature/voucher/infrastructure/VoucherGateway').then(({ VoucherGateway }) => new VoucherGateway(appConfig.apiBaseUrl)));
  return Object.freeze({
    approval: Object.freeze({
      registry: approvals,
      port: approval,
      read: new ReadApprovals(approval),
      readInstance: new ReadApprovalInstance(approval),
      manage: new ManageApprovalTemplate(approval),
      decide: new DecideApprovalTask(approval),
      createIdentity: createIdempotencyKey,
    }),
    channel: Object.freeze({
      registry: extensions,
      port: channel,
      read: new ReadChannels(channel),
      create: new CreateConnection(channel),
      update: new UpdateConnection(channel),
      test: new TestConnection(channel),
      enable: new EnableConnection(channel),
      disable: new DisableConnection(channel),
      startSync: new StartSync(channel),
      cancelSync: new CancelSync(channel),
      replay: new ReplayOperation(channel),
      createIdentity: createIdempotencyKey,
    }),
    invitation: Object.freeze({
      port: invitation,
      read: new ReadInvitations(invitation),
      memberships: new ReadMemberships(invitation),
      create: new CreateInvitation(invitation),
      revoke: new RevokeInvitation(invitation),
      createIdentity: createIdempotencyKey,
    }),
    referral: Object.freeze({
      port: referral,
      read: new ReadReferral(referral),
      manageSetting: new ManageSetting(referral),
      manageProduct: new ManageProduct(referral),
      reviewMember: new ReviewMember(referral),
      prepare: new PrepareReferral(),
      createIdentity: createIdempotencyKey,
    }),
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
      execute: new ExecuteVoucher(voucher),
    }),
  });
}
