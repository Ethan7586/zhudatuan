export const SCOPE_KINDS = ['platform', 'distributor', 'tenant', 'enterprise', 'mall', 'department', 'supplier', 'brand', 'store', 'owner', 'self'] as const;
export type ScopeKind = (typeof SCOPE_KINDS)[number];

export const CONSOLE_SCOPE_KINDS = ['platform', 'distributor', 'enterprise', 'mall'] as const satisfies readonly ScopeKind[];
export type ConsoleScopeKind = (typeof CONSOLE_SCOPE_KINDS)[number];

export function isConsoleScopeKind(value: ScopeKind): value is ConsoleScopeKind {
  return (CONSOLE_SCOPE_KINDS as readonly ScopeKind[]).includes(value);
}
