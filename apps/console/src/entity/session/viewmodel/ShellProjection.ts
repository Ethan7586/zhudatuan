import { isConsoleScopeKind, type ConsoleScopeKind } from '@shop/authz';
import { chineseReference } from '@shop/presentation';
import type { ConsoleNavigationNode, ConsoleScope } from '../ConsoleSession';

const scopeLabels: Readonly<Record<ConsoleScopeKind, string>> = Object.freeze({ platform: '平台', distributor: '分销', enterprise: '集团', mall: '商城' });

export interface ShellDestination {
  readonly key: string;
  readonly title: string;
  readonly detail: string;
  readonly route: string;
  readonly icon: string;
  readonly component: string;
}

export interface ScopeChoice {
  readonly value: string;
  readonly label: string;
}

export interface ScopeCrumb {
  readonly key: string;
  readonly label: string;
  readonly current: boolean;
}

export function projectShellNavigation(nodes: readonly ConsoleNavigationNode[]) {
  const destinations: ShellDestination[] = [];
  const routes = new Set<string>();
  for (const node of flattenShellNavigation(nodes)) {
    if (node.experience.disabled || node.experience.placement === 'contextual' || routes.has(node.experience.route)) continue;
    routes.add(node.experience.route);
    destinations.push(
      Object.freeze({
        key: node.key,
        title: node.title,
        detail: node.experience.breadcrumbs.map(({ title }) => title).join(' › '),
        route: node.experience.route,
        icon: node.experience.icon,
        component: node.experience.component,
      })
    );
  }
  const frozen = Object.freeze(destinations);
  return Object.freeze({
    destinations: frozen,
    notification: frozen.find(({ component }) => component === 'notification'),
    support: frozen.find(({ component }) => component === 'support'),
  });
}

export function flattenShellNavigation(nodes: readonly ConsoleNavigationNode[]): readonly ConsoleNavigationNode[] {
  return Object.freeze(nodes.flatMap((node) => [node, ...flattenShellNavigation(node.children)]));
}

export function projectScopes(current: ConsoleScope, scopes: readonly ConsoleScope[]) {
  const choices = Object.freeze(scopes.map((scope) => Object.freeze({ value: scopeValue(scope), label: scopeLabel(scope) })));
  const available = new Map(scopes.map((scope) => [scopeValue(scope), scope]));
  const ancestry = (current.path ?? [])
    .filter(({ kind }) => isConsoleScopeKind(kind))
    .map(({ kind, id }) => available.get(`${kind}:${id}`) ?? ({ kind, id } as ConsoleScope));
  const hierarchy = [...ancestry.filter((scope) => scopeValue(scope) !== scopeValue(current)), current];
  const seen = new Set<string>();
  const trail = Object.freeze(
    hierarchy.flatMap((scope) => {
      const key = scopeValue(scope);
      if (seen.has(key)) return [];
      seen.add(key);
      return [Object.freeze({ key, label: scopeLabel(scope), current: key === scopeValue(current) })];
    })
  );
  return Object.freeze({ choices, trail, label: scopeLabel(current), type: scopeTypeLabel(current.kind), name: scopeName(current) });
}

export function scopeTypeLabel(kind: ConsoleScopeKind): string {
  return scopeLabels[kind];
}

function scopeLabel(scope: ConsoleScope): string {
  return `${scopeTypeLabel(scope.kind)} · ${scopeName(scope)}`;
}

function scopeName(scope: ConsoleScope): string {
  return scope.name ?? chineseReference(`${scopeTypeLabel(scope.kind)}范围`, scope.id);
}

function scopeValue(scope: Pick<ConsoleScope, 'kind' | 'id'>): string {
  return `${scope.kind}:${scope.id}`;
}
