export interface InvitationTarget {
  readonly id: string;
  readonly name: string;
}

interface ScopeView {
  readonly id: string;
  readonly kind: string;
  readonly name?: string | undefined;
  readonly path?: readonly Readonly<{ id: string }>[] | undefined;
}

export function invitationTargets(current: ScopeView, scopes: readonly ScopeView[]): readonly InvitationTarget[] {
  if (current.kind === 'mall') return Object.freeze([{ id: current.id, name: current.name ?? current.id }]);
  const targets = scopes.filter((scope) => scope.kind === 'mall' && scope.path?.some(({ id }) => id === current.id)).map((scope) => ({ id: scope.id, name: scope.name ?? scope.id }));
  const unique = [...new Map(targets.map((target) => [target.id, target] as const)).values()];
  unique.sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  return Object.freeze(unique.map((target) => Object.freeze(target)));
}
