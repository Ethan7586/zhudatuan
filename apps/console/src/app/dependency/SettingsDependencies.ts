import { ManageOverride } from '../../feature/settings/access/application/ManageOverride';
import { ManageRole } from '../../feature/settings/access/application/ManageRole';
import { ManageScope } from '../../feature/settings/access/application/ManageScope';
import { PrepareAccess } from '../../feature/settings/access/application/PrepareAccess';
import { ReadAccess } from '../../feature/settings/access/application/ReadAccess';
import { TransferOwner } from '../../feature/settings/access/application/TransferOwner';
import { AccessGateway } from '../../feature/settings/access/infrastructure/AccessGateway';
import type { AccessPort } from '../../feature/settings/access/public';
import { CancelSync } from '../../feature/settings/directory/application/CancelSync';
import { ReadDirectories } from '../../feature/settings/directory/application/ReadDirectories';
import { ResumeSync } from '../../feature/settings/directory/application/ResumeSync';
import { StartSync } from '../../feature/settings/directory/application/StartSync';
import { DirectoryGateway } from '../../feature/settings/directory/infrastructure/DirectoryGateway';
import type { DirectoryPort } from '../../feature/settings/directory/public';
import { ReadFederations } from '../../feature/settings/federation/application/ReadFederations';
import { TestFederation } from '../../feature/settings/federation/application/TestFederation';
import { FederationGateway } from '../../feature/settings/federation/infrastructure/FederationGateway';
import type { FederationPort } from '../../feature/settings/federation/public';
import { CreateMemberImport } from '../../feature/settings/member/application/CreateMemberImport';
import { ManageMember } from '../../feature/settings/member/application/ManageMember';
import { ReadMembers } from '../../feature/settings/member/application/ReadMembers';
import { MemberGateway } from '../../feature/settings/member/infrastructure/MemberGateway';
import type { MemberPort } from '../../feature/settings/member/public';
import { ManageAnnouncement } from '../../feature/settings/notification/application/ManageAnnouncement';
import { ManageTemplate } from '../../feature/settings/notification/application/ManageTemplate';
import { PrepareNotification } from '../../feature/settings/notification/application/PrepareNotification';
import { ReadNotifications } from '../../feature/settings/notification/application/ReadNotifications';
import { NotificationGateway } from '../../feature/settings/notification/infrastructure/NotificationGateway';
import type { NotificationPort } from '../../feature/settings/notification/public';
import { ManagePartner } from '../../feature/settings/partner/application/ManagePartner';
import { ManageStore } from '../../feature/settings/partner/application/ManageStore';
import { ReadPartners } from '../../feature/settings/partner/application/ReadPartners';
import { ReadStores } from '../../feature/settings/partner/application/ReadStores';
import { PartnerGateway } from '../../feature/settings/partner/infrastructure/PartnerGateway';
import type { PartnerKind } from '../../feature/settings/partner/model/Partner';
import type { PartnerPort } from '../../feature/settings/partner/public';
import { ManageQualification } from '../../feature/settings/qualification/application/ManageQualification';
import { PreviewQualification } from '../../feature/settings/qualification/application/PreviewQualification';
import { ReadQualifications } from '../../feature/settings/qualification/application/ReadQualifications';
import { QualificationGateway } from '../../feature/settings/qualification/infrastructure/QualificationGateway';
import type { QualificationPort } from '../../feature/settings/qualification/public';
import { ManageRiskPolicy } from '../../feature/settings/risk/application/ManageRiskPolicy';
import { PrepareRisk } from '../../feature/settings/risk/application/PrepareRisk';
import { ReadRisk } from '../../feature/settings/risk/application/ReadRisk';
import { ReviewRiskCase } from '../../feature/settings/risk/application/ReviewRiskCase';
import { RiskGateway } from '../../feature/settings/risk/infrastructure/RiskGateway';
import type { RiskPort } from '../../feature/settings/risk/public';
import { appConfig } from '../../shared/config/AppConfig';

export interface AccessDependencies {
  readonly port: AccessPort;
  readonly read: ReadAccess;
  readonly role: ManageRole;
  readonly override: ManageOverride;
  readonly scope: ManageScope;
  readonly owner: TransferOwner;
  readonly prepare: PrepareAccess;
  readonly createIdentity: () => string;
}
export interface DirectoryDependencies {
  readonly port: DirectoryPort;
  readonly read: ReadDirectories;
  readonly start: StartSync;
  readonly cancel: CancelSync;
  readonly resume: ResumeSync;
  readonly createIdentity: () => string;
}
export interface FederationDependencies {
  readonly port: FederationPort;
  readonly read: ReadFederations;
  readonly test: TestFederation;
  readonly createIdentity: () => string;
}
export interface MemberDependencies {
  readonly port: MemberPort;
  readonly read: ReadMembers;
  readonly manage: ManageMember;
  readonly createImport: CreateMemberImport;
  readonly createIdentity: () => string;
}
export interface NotificationDependencies {
  readonly port: NotificationPort;
  readonly read: ReadNotifications;
  readonly manageTemplate: ManageTemplate;
  readonly manageAnnouncement: ManageAnnouncement;
  readonly prepare: PrepareNotification;
  readonly createIdentity: () => string;
  readonly createReference: NotificationPort['createReference'];
}
export interface PartnerDependencies {
  readonly port: PartnerPort;
  readonly readPartners: ReadPartners;
  readonly readStores: ReadStores;
  readonly managePartner: ManagePartner;
  readonly manageStore: ManageStore;
  readonly createIdentity: () => string;
  readonly createReference: PartnerPort['createReference'];
}
export interface QualificationDependencies {
  readonly port: QualificationPort;
  readonly read: ReadQualifications;
  readonly preview: PreviewQualification;
  readonly manage: ManageQualification;
  readonly createIdentity: () => string;
  readonly createReference: () => string;
}
export interface RiskDependencies {
  readonly port: RiskPort;
  readonly read: ReadRisk;
  readonly managePolicy: ManageRiskPolicy;
  readonly reviewCase: ReviewRiskCase;
  readonly prepare: PrepareRisk;
  readonly createIdentity: () => string;
  readonly createReference: () => string;
}

export interface SettingsDependencies {
  readonly access: AccessDependencies;
  readonly directory: DirectoryDependencies;
  readonly federation: FederationDependencies;
  readonly member: MemberDependencies;
  readonly notification: NotificationDependencies;
  readonly partner: PartnerDependencies;
  readonly qualification: QualificationDependencies;
  readonly risk: RiskDependencies;
}

export function createSettingsDependencies(): SettingsDependencies {
  const access = new AccessGateway(appConfig.apiBaseUrl);
  const directory = new DirectoryGateway(appConfig.apiBaseUrl);
  const federation = new FederationGateway(appConfig.apiBaseUrl);
  const member = new MemberGateway(appConfig.apiBaseUrl);
  const notification = new NotificationGateway(appConfig.apiBaseUrl);
  const partner = new PartnerGateway(appConfig.apiBaseUrl);
  const qualification = new QualificationGateway(appConfig.apiBaseUrl);
  const risk = new RiskGateway(appConfig.apiBaseUrl);
  return Object.freeze({
    access: Object.freeze({
      port: access,
      read: new ReadAccess(access),
      role: new ManageRole(access),
      override: new ManageOverride(access),
      scope: new ManageScope(access),
      owner: new TransferOwner(access),
      prepare: new PrepareAccess(access),
      createIdentity: () => access.createIdentity(),
    }),
    directory: Object.freeze({
      port: directory,
      read: new ReadDirectories(directory),
      start: new StartSync(directory),
      cancel: new CancelSync(directory),
      resume: new ResumeSync(directory),
      createIdentity: () => directory.createIdentity(),
    }),
    federation: Object.freeze({ port: federation, read: new ReadFederations(federation), test: new TestFederation(federation), createIdentity: () => federation.createIdentity() }),
    member: Object.freeze({ port: member, read: new ReadMembers(member), manage: new ManageMember(member), createImport: new CreateMemberImport(member), createIdentity: () => member.createIdentity() }),
    notification: Object.freeze({
      port: notification,
      read: new ReadNotifications(notification),
      manageTemplate: new ManageTemplate(notification),
      manageAnnouncement: new ManageAnnouncement(notification),
      prepare: new PrepareNotification(),
      createIdentity: () => notification.createIdentity(),
      createReference: (kind: 'template' | 'announcement') => notification.createReference(kind),
    }),
    partner: Object.freeze({
      port: partner,
      readPartners: new ReadPartners(partner),
      readStores: new ReadStores(partner),
      managePartner: new ManagePartner(partner),
      manageStore: new ManageStore(partner),
      createIdentity: () => partner.createIdentity(),
      createReference: (kind: PartnerKind | 'store') => partner.createReference(kind),
    }),
    qualification: Object.freeze({
      port: qualification,
      read: new ReadQualifications(qualification),
      preview: new PreviewQualification(qualification),
      manage: new ManageQualification(qualification),
      createIdentity: () => qualification.createIdentity(),
      createReference: () => qualification.createReference(),
    }),
    risk: Object.freeze({
      port: risk,
      read: new ReadRisk(risk),
      managePolicy: new ManageRiskPolicy(risk),
      reviewCase: new ReviewRiskCase(risk),
      prepare: new PrepareRisk(),
      createIdentity: () => risk.createIdentity(),
      createReference: () => risk.createReference(),
    }),
  });
}
