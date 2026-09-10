import { actionField, requiredText } from '@shop/presentation/actions';
import { defineStoreViewModel } from '../../../shared/FeatureViewModel';
import { operatorCollection as displayCollection, operatorItems as dataItems, operatorRecord as dataRecord, operatorRow as displayRow, operatorText as recordText } from '@shop/presentation/operator';

export const accountViewModel = defineStoreViewModel({
  routes: ['storeaccountwork'],
  title: '员工账户与交班',
  description: '核对当前员工身份并查看交班记录；确认交班后，本会话立即失效。',
  read: async (client, context) => {
    const [profile, handovers] = await Promise.all([client.member.profileRead({}, context), client.identity.handoversRead({ query: { limit: 50 } }, context)]);
    return { profile, handovers };
  },
  project: accountProjection,
  actions: () =>
    Object.freeze([
      Object.freeze({
        id: 'handover',
        label: '确认交班并退出',
        description: '记录交班说明并立即结束当前门店会话。',
        confirmation: '提交后本机当前会话立即失效，需要下一位员工重新登录。',
        tone: 'danger',
        fields: Object.freeze([actionField('note', '交班说明', { kind: 'textarea', maximumLength: 500 })]),
      }),
    ]),
  execute: async (client, context, _route, _value, _selectedKey, action, input) => {
    if (action.id !== 'handover') throw new Error('未知交班操作。');
    await client.identity.handoversCreate({ body: { note: requiredText(input, 'note', 500) } }, context);
    return { message: '交班完成，当前会话已安全退出。', sessionEnded: true, refresh: false };
  },
});

function accountProjection(value: unknown) {
  const root = dataRecord(value);
  const profile = dataRecord(root?.profile);
  const handovers = dataItems(root?.handovers);
  const rows = [
    ...(profile
      ? [
          displayRow({
            key: recordText(profile, 'membership_id') || recordText(profile, 'id'),
            title: recordText(profile, 'display_name'),
            detail: profile.employee_no ? `工号 ${recordText(profile, 'employee_no')} · 当前登录员工` : '当前登录员工',
            status: recordText(profile, 'status'),
            timestamp: recordText(profile, 'joined_at'),
          }),
        ]
      : []),
    ...handovers.map((item) => displayRow({ key: recordText(item, 'id'), title: '交班记录', detail: recordText(item, 'note'), status: '已交班', timestamp: recordText(item, 'handedOverAt') })),
  ];
  return displayCollection(root?.handovers, rows);
}
