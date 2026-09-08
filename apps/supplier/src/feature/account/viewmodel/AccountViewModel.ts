import { operatorCollection, operatorRecord, operatorRow, operatorText } from '@shop/presentation/operator';
import { defineSupplierViewModel } from '../../../shared/FeatureViewModel';

export const accountViewModel = defineSupplierViewModel({
  routes: ['supplieraccount'], title: '供应商账户', description: '核对当前操作人员、组织归属和会话版本；权限由平台统一授权。',
  read: (client, context) => client.member.profileRead({}, context),
  project: (value) => {
    const item = operatorRecord(value);
    return operatorCollection(value, item ? [operatorRow({
      key: operatorText(item, 'membership_id') || operatorText(item, 'id'), title: operatorText(item, 'display_name'),
      detail: `${operatorText(item, 'employee_no') ? `工号 ${operatorText(item, 'employee_no')} · ` : ''}组织 ${operatorText(item, 'organization_id')}`,
      statusLabel: operatorText(item, 'status') === 'active' ? '账户正常' : '账户受限', timestamp: operatorText(item, 'joined_at'),
    })] : []);
  },
});
