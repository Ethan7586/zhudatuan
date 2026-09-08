import { chineseDomainLabel } from '@shop/presentation';
import type { ConsoleNavigationNode, ConsoleScope } from '../../../entity/session/ConsoleSession';
import { flattenEnabledNavigation, navigationPath } from '../../../shared/url/NavigationPath';
import type { SettingsWorkspace } from '../model/Settings';

export function createSettingsViewModel(nodes: readonly ConsoleNavigationNode[], scope: ConsoleScope, assurance: number): SettingsWorkspace {
  const modules = flattenEnabledNavigation(nodes)
    .filter((node) => node.experience.placement !== 'contextual')
    .map((node) =>
      Object.freeze({
        id: node.key,
        title: node.title,
        component: node.experience.component,
        href: navigationPath(node, scope),
      })
    );
  return Object.freeze({
    modules: Object.freeze(modules),
    assurance: `第 ${assurance} 级`,
    scope: scope.name ?? chineseDomainLabel(scope.kind),
  });
}
