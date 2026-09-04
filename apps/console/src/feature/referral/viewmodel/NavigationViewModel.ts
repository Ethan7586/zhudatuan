import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { scopeRoutePath } from '../../../shared/url/ScopePath';
import type { ReferralSection } from '../model/Referral';

export const referralNavigation = Object.freeze([
  { key: 'settings', title: '分销设定', description: '管理首次归因、默认返佣与最低提现策略。', boundary: '修改策略需完成高强度二次验证，由另一位复核人签发一次性复核凭证，并校验当前版本和审计原因。' },
  { key: 'product', title: '分销商品', description: '查看并管理商品返佣启停状态与比例版本。', boundary: '商品比例按订单快照固化；修改不会回写历史佣金。' },
  { key: 'review', title: '分销审核', description: '审核推广会员申请并管理推广资格。', boundary: '申请人、操作人和复核人分离；版本冲突时必须重读后再决定。' },
  { key: 'binding', title: '分销关系', description: '查看客户与推广会员的一层首次有效绑定。', boundary: '有效绑定不能被后续链接覆盖，Token 只保存不可逆指纹。' },
  { key: 'withdrawal', title: '佣金提现', description: '查看本人提现申请、处理结果和版本。', boundary: '提现只使用可用余额；申请、冲正和付款通过确定性业务键防重。' },
  { key: 'promotion', title: '推广详情', description: '按订单查看佣金、可结算时间和冲正终态。', boundary: '退款仅追加反向 Movement，原始佣金和财务分录不可删除。' },
] satisfies readonly Readonly<{ key: ReferralSection; title: string; description: string; boundary: string }>[]);

export function useReferralNavigationViewModel(context: ConsoleContext, active: ReferralSection) {
  const navigate = useNavigate();
  const select = useCallback(
    (section: ReferralSection) => {
      void navigate(scopeRoutePath(context.scope, 'consolereferralview', { view: section }));
    },
    [context.scope, navigate]
  );
  return useMemo(() => Object.freeze({ active, items: referralNavigation, select }), [active, select]);
}

export type ReferralNavigationViewModel = ReturnType<typeof useReferralNavigationViewModel>;
