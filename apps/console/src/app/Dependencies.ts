import { createCoreDependencies, type CoreDependencies } from './dependency/CoreDependencies';
import { createServiceDependencies, type ServiceDependencies } from './dependency/ServiceDependencies';
import { createSettingsDependencies, type SettingsDependencies } from './dependency/SettingsDependencies';
import { createSessionDependencies, type SessionDependencies } from './dependency/SessionDependencies';
import { consoleRegistries, type ConsoleRegistries } from './registry/Registries';

export type ConsoleDependencies = CoreDependencies & ServiceDependencies & SettingsDependencies & Readonly<{ session: SessionDependencies }>;

export type { CockpitDependencies, ControlDependencies, ExperienceDependencies, FinanceDependencies, OrderDependencies, ProductDependencies, TaskDependencies } from './dependency/CoreDependencies';
export type { ApprovalDependencies, ChannelDependencies, InvitationDependencies, ReferralDependencies, ReportingDependencies, SupportDependencies, VoucherDependencies } from './dependency/ServiceDependencies';
export type { AccessDependencies, DirectoryDependencies, FederationDependencies, MemberDependencies, NotificationDependencies, PartnerDependencies, QualificationDependencies, RiskDependencies } from './dependency/SettingsDependencies';
export type { SessionDependencies } from './dependency/SessionDependencies';
export type { ApprovalRegistryPort } from './registry/ApprovalRegistry';
export type { ImportRegistryPort } from './registry/ImportRegistry';
export type { ExtensionRegistryPort } from './registry/ExtensionRegistry';

export function createConsoleDependencies(registries: ConsoleRegistries = consoleRegistries): ConsoleDependencies {
  return Object.freeze({ ...createCoreDependencies(registries.imports), ...createServiceDependencies(registries.approval, registries.extensions), ...createSettingsDependencies(), ...createSessionDependencies() });
}
