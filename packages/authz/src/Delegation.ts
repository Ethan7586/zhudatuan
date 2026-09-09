import { permissionDefinition } from './PermissionCatalog';

export function canDelegatePermissions(issuer: ReadonlySet<string>, denied: ReadonlySet<string>, target: readonly string[]): boolean {
  return target.every((code) => isDelegatable(code) && issuer.has(code) && !denied.has(code));
}

function isDelegatable(code: string): boolean {
  try {
    return permissionDefinition(code).delegatable;
  } catch {
    return false;
  }
}
