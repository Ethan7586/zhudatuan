export const SCOPE_KINDS = ['platform', 'distributor', 'tenant', 'enterprise', 'mall', 'department', 'supplier', 'brand', 'store', 'owner', 'self'] as const;
export type ScopeKind = (typeof SCOPE_KINDS)[number];

export const CONSOLE_SCOPE_KINDS = ['platform', 'distributor', 'enterprise', 'mall'] as const satisfies readonly ScopeKind[];
export type ConsoleScopeKind = (typeof CONSOLE_SCOPE_KINDS)[number];

export const NAVIGATION_SCOPE_KINDS = [...CONSOLE_SCOPE_KINDS, 'store', 'supplier'] as const satisfies readonly ScopeKind[];
export type NavigationScopeKind = (typeof NAVIGATION_SCOPE_KINDS)[number];

export function isConsoleScopeKind(value: ScopeKind): value is ConsoleScopeKind {
  return (CONSOLE_SCOPE_KINDS as readonly ScopeKind[]).includes(value);
}

export function isNavigationScopeKind(value: ScopeKind): value is NavigationScopeKind {
  return (NAVIGATION_SCOPE_KINDS as readonly ScopeKind[]).includes(value);
}
