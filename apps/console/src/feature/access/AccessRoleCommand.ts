import { createFetchAccessRolesManage } from '@shop/sdk/access';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleCommand } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { AccessRoleWriteReceiptSchema, type AccessRole } from './AccessSchema';

const rolesManage = createFetchAccessRolesManage(appConfig.apiBaseUrl);

export interface AccessRoleDraft {
  readonly id: string;
  readonly name: string;
  readonly permissions: readonly string[];
  readonly version?: number;
}

export function roleCommandAvailable(context: ConsoleContext): boolean {
  return context.session.csrf !== undefined
    && context.session.permissions.includes('access.role.manage')
    && context.session.capabilities.includes('access.roles.manage');
}

export async function saveAccessRole(context: ConsoleContext, draft: AccessRoleDraft, signal?: AbortSignal) {
  if (!roleCommandAvailable(context)) throw new Error('ACCESS_ROLE_COMMAND_NOT_AVAILABLE');
  const response = await rolesManage(
    { path: { roleid: draft.id }, body: { name: draft.name, permissions: [...draft.permissions] } },
    consoleCommand(context.scope, {
      accessVersion: context.session.accessVersion,
      csrfToken: context.session.csrf!,
      ...(draft.version === undefined ? {} : { expectedVersion: draft.version }),
      ...(signal === undefined ? {} : { signal }),
    }),
  );
  return AccessRoleWriteReceiptSchema.parse(response);
}

export function verifyAccessRoleSave(draft: AccessRoleDraft, receipt: Readonly<{ version: number }>, roles: readonly AccessRole[]): AccessRole {
  const saved = roles.find(({ id }) => id === draft.id);
  const requestedPermissions = [...new Set(draft.permissions)].sort();
  const savedPermissions = saved === undefined ? [] : [...new Set(saved.permissions)].sort();
  if (saved === undefined
    || saved.name !== draft.name
    || saved.version !== receipt.version
    || requestedPermissions.length !== savedPermissions.length
    || requestedPermissions.some((permission, index) => permission !== savedPermissions[index])) {
    throw new Error('ACCESS_ROLE_SAVE_VERIFICATION_FAILED');
  }
  return saved;
}
