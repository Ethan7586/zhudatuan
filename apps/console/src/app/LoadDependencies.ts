import type { ComponentType } from 'react';
import { composeConsoleDependencies, type ConsoleDependencies } from './ComposeDependencies';
import { createCoreDependencies } from './dependency/CoreDependencies';

export interface ConsoleApplication {
  readonly dependencies: ConsoleDependencies;
  readonly Component: ComponentType;
}

export async function loadConsoleApplication(supplied?: ConsoleDependencies): Promise<ConsoleApplication> {
  const dependencies = supplied ?? await createDefaultDependencies();
  const { ConsoleApp } = await import('./ConsoleApp');
  return Object.freeze({ dependencies, Component: ConsoleApp });
}

async function createDefaultDependencies(): Promise<ConsoleDependencies> {
  const [{ createServiceDependencies }, { createSettingsDependencies }, { createSessionDependencies }, { consoleRegistries }] = await Promise.all([
    import('./dependency/ServiceDependencies'),
    import('./dependency/SettingsDependencies'),
    import('./dependency/SessionDependencies'),
    import('./registry/Registries'),
  ]);
  return composeConsoleDependencies(createCoreDependencies(consoleRegistries.imports), createServiceDependencies(consoleRegistries.approval, consoleRegistries.extensions), createSettingsDependencies(), createSessionDependencies());
}
