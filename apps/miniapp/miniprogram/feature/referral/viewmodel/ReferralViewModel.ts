import { bindBindingsCreate, bindBindingsRead, bindEarningsRead, bindLinksRead, bindMembersApply, bindWithdrawalsCreate, bindWithdrawalsRead } from '@shop/sdk/referral';
import { connectMiniappClient, defineMiniappFeature } from '../../../shared/FeatureViewModel';
import type { OperationOutputFor } from '@shop/contract';
import { actionField, requiredMoneyMinor, requiredText } from '@shop/presentation/actions';
import { displayItem, displayPage, money } from '../../../shared/Display';

export const referralViewModel = defineMiniappFeature({
  defaultRoute: 'miniappreferral', routes: ['miniappreferral'], title: '推荐收益', description: '查看推荐关系与已入账收益。',
  connect: (executor) => connectMiniappClient({ referral: {
    bindingsCreate: bindBindingsCreate(executor), bindingsRead: bindBindingsRead(executor), earningsRead: bindEarningsRead(executor),
    linksRead: bindLinksRead(executor), membersApply: bindMembersApply(executor), withdrawalsCreate: bindWithdrawalsCreate(executor), withdrawalsRead: bindWithdrawalsRead(executor),
  } }),
  read: async (client, context) => {
    const [earnings, bindings, link, withdrawals] = await Promise.all([
      client.referral.earningsRead({ query: { limit: '30' } }, context),
      client.referral.bindingsRead({ query: { limit: '30' } }, context),
      client.referral.linksRead({}, context),
      client.referral.withdrawalsRead({ query: { limit: '30' } }, context),
    ]);
    return Object.freeze({ earnings, bindings, link, withdrawals });
  },
  project: (value) => {
    const source = referral(value);
    return displayPage(
      [displayItem('earnings', '可提现推荐收益', `${money(source.earnings.availableMinor, source.earnings.currency)} · 待入账 ${money(source.earnings.pendingMinor, source.earnings.currency)}`, 'available')],
      source.bindings.items.map((item) => displayItem(item.id, '推荐关系', item.expiresAt === null ? '长期有效' : '在有效期内按规则归因', item.status, item.boundAt)),
      source.withdrawals.items.map((item) => displayItem(item.id, '提现申请', `${money(item.amountMinor, item.currency)} · 收款信息已脱敏保存`, item.status, item.requestedAt))
    );
  },
  actions: (value) => {
    const source = referral(value);
    return [
      Object.freeze({ id: 'apply', label: '申请成为推荐成员', description: '提交真实姓名、手机号与申请原因，审核状态以服务端为准。', tone: 'primary' as const, fields: [
        actionField('displayName', '姓名', { maximumLength: 100 }),
        actionField('mobile', '手机号', { maximumLength: 32 }),
        actionField('reason', '申请原因', { maximumLength: 1000 }),
      ] }),
      Object.freeze({ id: 'bind', label: '绑定推荐关系', description: '粘贴推荐人分享给你的推荐口令。', tone: 'secondary' as const, fields: [actionField('token', '推荐口令', { maximumLength: 512 })] }),
      Object.freeze({ id: 'share', label: '复制我的推荐链接', description: '复制后可通过微信发送给好友。', tone: 'secondary' as const, fields: [] }),
      ...(source.earnings.availableMinor > 0 ? [Object.freeze({
        id: 'withdraw', label: '申请提现', description: `当前可提现 ¥${(source.earnings.availableMinor / 100).toFixed(2)}，提交后可在本页跟踪状态。`, tone: 'primary' as const,
        expectedVersion: source.earnings.version,
        confirmation: '确认提交本次提现申请？',
        fields: [actionField('amount', '提现金额（元）', { kind: 'number', placeholder: '0.00', maximumLength: 14 }), actionField('account', '收款账户', { maximumLength: 255 })],
      })] : []),
    ];
  },
  execute: async (client, context, _route, value, action, input) => {
    const source = referral(value);
    if (action.id === 'apply') {
      await client.referral.membersApply({ body: { displayName: requiredText(input, 'displayName', 100), mobile: requiredText(input, 'mobile', 32), reason: requiredText(input, 'reason', 1000) } }, context);
      return { message: '推荐成员申请已提交。' };
    }
    if (action.id === 'bind') {
      await client.referral.bindingsCreate({ body: { token: requiredText(input, 'token', 512), source: 'miniapp' } }, context);
      return { message: '推荐关系已绑定。' };
    }
    if (action.id === 'share') return { message: '推荐链接已复制。', clipboard: source.link.url };
    if (action.id === 'withdraw') {
      const amountMinor = requiredMoneyMinor(input, 'amount');
      if (amountMinor > source.earnings.availableMinor) throw new Error('MINIAPP_REFERRAL_BALANCE_INSUFFICIENT');
      await client.referral.withdrawalsCreate({ body: { amountMinor, currency: source.earnings.currency, accountRef: requiredText(input, 'account'), expectedVersion: source.earnings.version } }, context);
      return { message: '提现申请已提交。' };
    }
    throw new Error('MINIAPP_REFERRAL_ACTION_INVALID');
  },
});

interface ReferralSnapshot {
  readonly earnings: OperationOutputFor<'referral.earnings.read'>;
  readonly bindings: OperationOutputFor<'referral.bindings.read'>;
  readonly link: OperationOutputFor<'referral.links.read'>;
  readonly withdrawals: OperationOutputFor<'referral.withdrawals.read'>;
}

function referral(value: unknown): ReferralSnapshot {
  return value as ReferralSnapshot;
}
