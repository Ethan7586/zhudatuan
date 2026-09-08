import type { CoreDependencies } from './dependency/CoreDependencies';
import type { ServiceDependencies } from './dependency/ServiceDependencies';
import type { SessionDependencies } from './dependency/SessionDependencies';
import type { SettingsDependencies } from './dependency/SettingsDependencies';

export type ConsoleDependencies = CoreDependencies & ServiceDependencies & SettingsDependencies & Readonly<{ session: SessionDependencies }>;

export function composeConsoleDependencies(
  core: CoreDependencies,
  services: ServiceDependencies,
  settings: SettingsDependencies,
  session: Readonly<{ session: SessionDependencies }>
): ConsoleDependencies {
  return Object.freeze({ ...core, ...services, ...settings, ...session });
}
