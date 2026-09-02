export interface InvitationTarget {
  readonly id: string;
  readonly name: string;
}

interface ScopeView {
  readonly id: string;
  readonly kind: string;
  readonly name?: string | undefined;
  readonly parent_id?: string | null | undefined;
  readonly path?: readonly Readonly<{ id: string }>[] | undefined;
}

export function invitationTargets(current: ScopeView, scopes: readonly ScopeView[]): readonly InvitationTarget[] {
  if (current.kind === 'mall') return Object.freeze([{ id: current.id, name: current.name ?? current.id }]);
  const indexed = new Map(scopes.map((scope) => [scope.id, scope] as const));
  indexed.set(current.id, current);
  const targets = scopes.filter((scope) => scope.kind === 'mall' && governedBy(current.id, scope, indexed)).map((scope) => ({ id: scope.id, name: scope.name ?? scope.id }));
  const unique = [...new Map(targets.map((target) => [target.id, target] as const)).values()];
  unique.sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  return Object.freeze(unique.map((target) => Object.freeze(target)));
}

function governedBy(current: string, target: ScopeView, scopes: ReadonlyMap<string, ScopeView>): boolean {
  if (target.id === current || target.path?.some(({ id }) => id === current)) return true;
  const visited = new Set<string>([target.id]);
  let parent = target.parent_id;
  while (parent) {
    if (parent === current) return true;
    if (visited.has(parent)) return false;
    visited.add(parent);
    parent = scopes.get(parent)?.parent_id;
  }
  return false;
}
