import type { Client } from 'pg';
import type { KmsClient } from '../../../services/commerce/src/pipeline/KmsPort';
import { ensureLocalConsoleAccount } from './LocalConsole';
import { LOCAL_OWNER } from './LocalOwner';

export const LOCAL_OPERATOR = Object.freeze({
  principal: 'principal:zhudatuan:operator:li:v1',
  member: 'member:zhudatuan:operator:li:v1',
  membership: 'membership-enterprise-operator-li-v1',
  role: 'role-enterprise-operator-li-v1',
  subject: 'liyunying',
  mobile: '+8613700137000',
});

export function ensureLocalOperator(database: Client, input: Readonly<{ passwordHash: string; identityKey: string; kms: KmsClient }>): Promise<void> {
  return ensureLocalConsoleAccount(
    database,
    {
      key: 'zhudatuan-operator-li',
      ...LOCAL_OPERATOR,
      mobileMasked: '137****7000',
      displayName: '李运营',
      employeeNo: 'SW_LOCAL_LI',
      organization: LOCAL_OWNER.enterprise,
      roleName: '企业运营',
      permissions: ['navigation.catalog.read', 'order.read', 'reporting.dashboard.read', 'access.center.read'],
      scopes: [
        { kind: 'enterprise', id: LOCAL_OWNER.enterprise, path: `${LOCAL_OWNER.tenant}/${LOCAL_OWNER.enterprise}` },
        { kind: 'mall', id: LOCAL_OWNER.mall, path: `${LOCAL_OWNER.tenant}/${LOCAL_OWNER.enterprise}/${LOCAL_OWNER.mall}` },
        { kind: 'self', id: `self:${LOCAL_OPERATOR.principal}`, path: `self:${LOCAL_OPERATOR.principal}` },
      ],
    },
    input
  );
}
