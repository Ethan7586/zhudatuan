import { createCoreDependencies, type CoreDependencies } from './dependency/CoreDependencies';
import { createServiceDependencies, type ServiceDependencies } from './dependency/ServiceDependencies';
import { createSettingsDependencies, type SettingsDependencies } from './dependency/SettingsDependencies';
import { createSessionDependencies, type SessionDependencies } from './dependency/SessionDependencies';

export type ConsoleDependencies = CoreDependencies & ServiceDependencies & SettingsDependencies & Readonly<{ session: SessionDependencies }>;

export type { CockpitDependencies, ControlDependencies, ExperienceDependencies, FinanceDependencies, OrderDependencies, ProductDependencies, TaskDependencies } from './dependency/CoreDependencies';
export type { ChannelDependencies, InvitationDependencies, ReferralDependencies, ReportingDependencies, SupportDependencies, VoucherDependencies } from './dependency/ServiceDependencies';
export type { AccessDependencies, DirectoryDependencies, FederationDependencies, MemberDependencies, NotificationDependencies, PartnerDependencies, QualificationDependencies, RiskDependencies } from './dependency/SettingsDependencies';
export type { SessionDependencies } from './dependency/SessionDependencies';

export function createConsoleDependencies(): ConsoleDependencies {
  return Object.freeze({ ...createCoreDependencies(), ...createServiceDependencies(), ...createSettingsDependencies(), ...createSessionDependencies() });
}
