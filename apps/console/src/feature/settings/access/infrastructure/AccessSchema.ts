import { exactOperationOutput } from '@shop/contract/schema';

export const AccessPageDtoSchema = exactOperationOutput('AccessCenterReadOutput');
export const OwnerReceiptDtoSchema = exactOperationOutput('AccessOwnersTransferOutput');
export const RoleReceiptDtoSchema = exactOperationOutput('AccessRolesManageOutput');
export const OverrideReceiptDtoSchema = exactOperationOutput('AccessOverridesManageOutput');
export const ScopeReceiptDtoSchema = exactOperationOutput('AccessScopesManageOutput');

export interface AccessPageDto {
  readonly items: readonly Readonly<{
    id: string;
    display_name: string;
    employee_no: string | null;
    mobile_masked: string | null;
    client: 'console' | 'storefront';
    status: 'invited' | 'active' | 'suspended' | 'left';
    access_version: number;
    roles: readonly Readonly<{ role: string; name: string; kind: 'custom' | 'system' | 'owner'; version: number; allows: readonly string[]; denies: readonly string[] }>[];
    scopes: readonly Readonly<{
      id: string;
      kind: 'platform' | 'distributor' | 'tenant' | 'enterprise' | 'mall' | 'department' | 'store' | 'supplier' | 'brand' | 'self' | 'owner';
      scope: string;
      effect: 'allow' | 'deny';
      expires: string | null;
    }>[];
    overrides: readonly Readonly<{ permission: string; effect: 'allow' | 'deny'; expires: string | null }>[];
  }>[];
  readonly count: number;
  readonly nextCursor?: string;
}
