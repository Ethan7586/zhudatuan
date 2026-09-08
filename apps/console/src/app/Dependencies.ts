import { createCoreDependencies } from './dependency/CoreDependencies';
import { createServiceDependencies } from './dependency/ServiceDependencies';
import { createSettingsDependencies } from './dependency/SettingsDependencies';
import { createSessionDependencies } from './dependency/SessionDependencies';
import { consoleRegistries, type ConsoleRegistries } from './registry/Registries';
import { composeConsoleDependencies, type ConsoleDependencies } from './ComposeDependencies';

export type { ConsoleDependencies } from './ComposeDependencies';

export type { CockpitDependencies, ControlDependencies, ExperienceDependencies, FinanceDependencies, OrderDependencies, ProductDependencies, TaskDependencies } from './dependency/CoreDependencies';
export type { ApprovalDependencies, ChannelDependencies, InvitationDependencies, ReferralDependencies, ReportingDependencies, SupportDependencies, VoucherDependencies } from './dependency/ServiceDependencies';
export type { AccessDependencies, DirectoryDependencies, FederationDependencies, MemberDependencies, NotificationDependencies, PartnerDependencies, QualificationDependencies, RiskDependencies } from './dependency/SettingsDependencies';
export type { SessionDependencies } from './dependency/SessionDependencies';
export type { ApprovalRegistryPort } from './registry/ApprovalRegistry';
export type { ImportRegistryPort } from './registry/ImportRegistry';
export type { ExtensionRegistryPort } from './registry/ExtensionRegistry';

export function createConsoleDependencies(registries: ConsoleRegistries = consoleRegistries): ConsoleDependencies {
  return composeConsoleDependencies(
    createCoreDependencies(registries.imports),
    createServiceDependencies(registries.approval, registries.extensions),
    createSettingsDependencies(),
    createSessionDependencies()
  );
}
