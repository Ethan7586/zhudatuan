import { createPreloadRegistry, type PreloadLoader } from '@shop/interaction';
import type { ConsoleModuleId, ConsoleModuleManifest } from '../../entity/navigation/ConsoleModuleManifest';
import { consoleModules } from '../../route/ConsoleModuleRegistry';
import {
  consoleInteractionTelemetry,
  type ConsoleInteractionTelemetry,
} from './ConsoleInteractionTelemetry';

interface ConsoleRouteLoadDefinition {
  readonly moduleId: string;
  readonly routeId: string;
  readonly entry: boolean;
  readonly load: PreloadLoader;
}

export interface ConsoleModulePreloader {
  readonly preloadModule: (moduleId: string, actionId: string) => Promise<unknown> | undefined;
  readonly loadRoute: <Result>(moduleId: string, routeId: string, loader: () => Promise<Result>) => Promise<Result>;
  readonly hasRoute: (routeId: string) => boolean;
  readonly dispose: () => void;
}

export function createConsoleModulePreloader(
  definitions: readonly ConsoleRouteLoadDefinition[],
  telemetry: ConsoleInteractionTelemetry = consoleInteractionTelemetry,
): ConsoleModulePreloader {
  const loaders: Partial<Record<string, PreloadLoader>> = {};
  const definitionsByRoute = new Map<string, ConsoleRouteLoadDefinition>();
  const entryByModule = new Map<string, ConsoleRouteLoadDefinition>();
  for (const definition of definitions) {
    loaders[definition.routeId] = definition.load;
    definitionsByRoute.set(definition.routeId, definition);
    if (definition.entry) entryByModule.set(definition.moduleId, definition);
  }
  const registry = createPreloadRegistry(loaders);

  const loadDefinition = (definition: ConsoleRouteLoadDefinition, actionId: string) => {
    const alreadyStarted = registry.has(definition.routeId);
    const task = registry.preload(definition.routeId);
    if (task === undefined || alreadyStarted) return task;

    const interactionId = telemetry.begin(definition.moduleId, actionId, 'module-load-start');
    void task.then(
      () => telemetry.finish(definition.moduleId, actionId, 'module-load-complete', interactionId),
      () => telemetry.finish(definition.moduleId, actionId, 'module-load-error', interactionId),
    );
    return task;
  };

  return {
    preloadModule(moduleId, actionId) {
      const definition = entryByModule.get(moduleId);
      return definition === undefined ? undefined : loadDefinition(definition, actionId);
    },
    loadRoute<Result>(moduleId: string, routeId: string, loader: () => Promise<Result>) {
      const definition = definitionsByRoute.get(routeId);
      if (definition === undefined || definition.moduleId !== moduleId || definition.load !== loader) return loader();
      return loadDefinition(definition, 'navigation.route-load') as Promise<Result>;
    },
    hasRoute: (routeId) => registry.has(routeId),
    dispose: () => registry.dispose(),
  };
}

function routeLoadDefinitions(modules: readonly ConsoleModuleManifest[]): readonly ConsoleRouteLoadDefinition[] {
  return modules.flatMap((module) => module.status !== 'enabled' ? [] : module.routes.flatMap((route) =>
    'lazy' in route ? [{ moduleId: module.id, routeId: route.id, entry: route.kind === 'entry', load: route.lazy }] : []));
}

const consoleModulePreloader = createConsoleModulePreloader(routeLoadDefinitions(consoleModules));

export type ConsoleNavigationIntent = 'idle' | 'hover' | 'focus' | 'pointerdown' | 'touchstart';

export function preloadConsoleModule(moduleId: ConsoleModuleId, intent: ConsoleNavigationIntent): Promise<unknown> | undefined {
  return consoleModulePreloader.preloadModule(moduleId, `navigation.${intent}`);
}

export function loadConsoleModuleRoute<Result>(
  moduleId: ConsoleModuleId,
  routeId: string,
  loader: () => Promise<Result>,
): Promise<Result> {
  return consoleModulePreloader.loadRoute(moduleId, routeId, loader);
}
