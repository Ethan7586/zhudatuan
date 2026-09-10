import { operatorCollection, operatorRecord, operatorRow, operatorText } from '@shop/presentation/operator';
import { defineSupplierViewModel } from '../../../shared/FeatureViewModel';

export const accountViewModel = defineSupplierViewModel({
  routes: ['supplieraccount'],
  title: '供应商账户',
  description: '核对当前操作人员、组织归属和会话版本；完成工作后可安全退出当前会话。',
  read: (client, context) => client.member.profileRead({}, context),
  project: (value) => {
    const item = operatorRecord(value);
    return operatorCollection(
      value,
      item
        ? [
            operatorRow({
              key: operatorText(item, 'membership_id') || operatorText(item, 'id'),
              title: operatorText(item, 'display_name'),
              detail: `${operatorText(item, 'employee_no') ? `工号 ${operatorText(item, 'employee_no')} · ` : ''}组织 ${operatorText(item, 'organization_id')}`,
              statusLabel: operatorText(item, 'status') === 'active' ? '账户正常' : '账户受限',
              timestamp: operatorText(item, 'joined_at'),
            }),
          ]
        : []
    );
  },
  actions: () =>
    Object.freeze([
      Object.freeze({
        id: 'logout',
        label: '退出登录',
        description: '结束当前供应商会话，并返回统一登录页。',
        confirmation: '退出后需要重新验证身份才能进入供应链后台。',
        tone: 'danger',
        identityScope: true,
        fields: Object.freeze([]),
      }),
    ]),
  execute: async (client, context, _route, _value, _selectedKey, action) => {
    if (action.id !== 'logout') throw new Error('未知账户操作。');
    await client.identity.sessionDelete({ body: {} }, context);
    return { message: '当前会话已安全退出。', sessionEnded: true, refresh: false };
  },
});
