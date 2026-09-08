import { actionField, requiredText } from '@shop/presentation/actions';
import { commandContext } from '../../../shared/Command';
import { defineStoreViewModel } from '../../../shared/FeatureViewModel';
import { verificationHistory } from '../../../shared/Verification';

const redeemAction = Object.freeze({
  id: 'redeem',
  label: '扫描核销',
  description: '扫描凭证与本机设备码，完成一次性防重放核销。',
  confirmation: '请当面核对顾客凭证；成功后凭证状态会立即变更。',
  tone: 'primary',
  identityScope: true,
  fields: Object.freeze([actionField('voucher', '顾客凭证', { kind: 'scan', maximumLength: 255 }), actionField('device', '本机设备码', { kind: 'scan', maximumLength: 512 })]),
} as const);

export const verificationViewModel = defineStoreViewModel({
  routes: ['storeverification'],
  title: '扫码核销',
  description: '凭证、门店、员工和可信设备四方绑定；重复、过期或离线请求均不会显示成功。',
  read: (client, context) => client.verification.historyRead({ query: { limit: 50 } }, context),
  project: verificationHistory,
  actions: () => Object.freeze([redeemAction]),
  execute: async (client, context, _route, _value, _selectedKey, action, input) => {
    if (action.id !== 'redeem') throw new Error('未知核销操作。');
    const issued = await client.verification.challengesIssue({ body: { purpose: 'voucher_redeem', voucher: requiredText(input, 'voucher', 255) } }, context);
    await client.verification.challengesVerify({ path: { challengeid: issued.id }, body: { token: issued.token, device: requiredText(input, 'device', 512) } }, commandContext(context));
    return { message: '核销成功，凭证已消费并写入门店审计记录。' };
  },
});
