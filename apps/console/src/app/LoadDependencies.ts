import type { ComponentType } from 'react';
import { LazyModule } from '@shop/kernel';
import { composeConsoleDependencies, type ConsoleDependencies } from './ComposeDependencies';
import { createCoreDependencies } from './dependency/CoreDependencies';

export interface ConsoleApplication {
  readonly dependencies: ConsoleDependencies;
  readonly Component: ComponentType;
}

const modules = Object.freeze({
  component: new LazyModule(() => import('./ConsoleApp')),
  finance: new LazyModule(() => import('./dependency/FinanceDependencies')),
  service: new LazyModule(() => import('./dependency/ServiceDependencies')),
  settings: new LazyModule(() => import('./dependency/SettingsDependencies')),
  session: new LazyModule(() => import('./dependency/SessionDependencies')),
  registries: new LazyModule(() => import('./registry/Registries')),
});
for (const module of Object.values(modules)) module.preload();

export async function loadConsoleApplication(supplied?: ConsoleDependencies): Promise<ConsoleApplication> {
  const [dependencies, { ConsoleApp }] = await Promise.all([supplied ?? createDefaultDependencies(), modules.component.load()]);
  return Object.freeze({ dependencies, Component: ConsoleApp });
}

async function createDefaultDependencies(): Promise<ConsoleDependencies> {
  const [{ createFinanceDependencies }, { createServiceDependencies }, { createSettingsDependencies }, { createSessionDependencies }, { consoleRegistries }] = await Promise.all([
    modules.finance.load(),
    modules.service.load(),
    modules.settings.load(),
    modules.session.load(),
    modules.registries.load(),
  ]);
  return composeConsoleDependencies(
    createCoreDependencies(consoleRegistries.imports, createFinanceDependencies()),
    createServiceDependencies(consoleRegistries.approval, consoleRegistries.extensions),
    createSettingsDependencies(),
    createSessionDependencies()
  );
}
