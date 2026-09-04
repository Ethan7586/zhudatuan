import { chineseDomainLabel } from '@shop/presentation';
import type { ConsoleNavigationNode, ConsoleScope } from '../../../entity/session/ConsoleSession';
import { navigationPath } from '../../../shared/url/NavigationPath';
import type { SettingsWorkspace } from '../model/Settings';

export function createSettingsViewModel(nodes: readonly ConsoleNavigationNode[], scope: ConsoleScope, assurance: number, registeredComponents: readonly string[]): SettingsWorkspace {
  const registered = new Set(registeredComponents);
  const modules = nodes
    .filter((node) => !node.disabled && registered.has(node.component))
    .map((node) =>
      Object.freeze({
        id: node.id,
        title: node.title,
        component: node.component,
        href: navigationPath(node, scope),
      })
    );
  return Object.freeze({
    modules: Object.freeze(modules),
    assurance: `第 ${assurance} 级`,
    scope: scope.name ?? chineseDomainLabel(scope.kind),
  });
}
