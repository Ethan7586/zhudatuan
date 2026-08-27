export const SCOPE_KINDS = ['platform', 'distributor', 'tenant', 'enterprise', 'mall', 'department', 'supplier', 'brand', 'store', 'owner', 'self'] as const;
export type ScopeKind = (typeof SCOPE_KINDS)[number];
