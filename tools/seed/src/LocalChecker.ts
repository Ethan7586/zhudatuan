import type { Client } from 'pg';
import type { KmsClient } from '../../../services/commerce/src/pipeline/KmsPort';
import { LOCAL_OWNER } from './LocalOwner';
import { ensureLocalConsoleAccount } from './LocalConsole';

export const LOCAL_CHECKER = Object.freeze({
  principal: 'principal:zhudatuan:checker:alice:v1',
  member: 'member:zhudatuan:checker:alice:v1',
  membership: 'membership-tenant-checker-alice-v1',
  role: 'role-tenant-checker-alice-v1',
  subject: 'alice',
  mobile: '+8613900139000',
});

export async function ensureLocalChecker(database: Client, input: Readonly<{ passwordHash: string; identityKey: string; kms: KmsClient }>): Promise<void> {
  await ensureLocalConsoleAccount(
    database,
    {
      key: 'zhudatuan-checker-alice',
      ...LOCAL_CHECKER,
      mobileMasked: '139****9000',
      displayName: 'Alice',
      employeeNo: 'SW_LOCAL_ALICE',
      organization: LOCAL_OWNER.tenant,
      roleName: '本地复核管理员',
      permissions: 'console',
      scopes: [
        { kind: 'tenant', id: LOCAL_OWNER.tenant, path: LOCAL_OWNER.tenant },
        { kind: 'mall', id: LOCAL_OWNER.mall, path: `${LOCAL_OWNER.tenant}/${LOCAL_OWNER.mall}` },
        { kind: 'self', id: `self:${LOCAL_CHECKER.principal}`, path: `self:${LOCAL_CHECKER.principal}` },
      ],
    },
    input
  );
}
