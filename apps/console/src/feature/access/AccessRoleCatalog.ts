import { PERMISSION_CATALOG } from '@shop/authz';

const categoryLabels: Readonly<Record<string, string>> = Object.freeze({
  runtime: '运行状态', identity: '账号与身份', organization: '组织', access: '身份与权限', capability: '能力配置',
  partner: '合作伙伴', member: '成员', qualification: '员工资格', channel: '渠道', catalog: '商品', pricing: '价格',
  inventory: '库存', marketing: '营销', referral: '分销返佣', reporting: '经营报表', experience: '应用体验', cart: '购物车',
  checkout: '结算', order: '订单与售后', fulfillment: '履约', payment: '支付', verification: '核验', voucher: '卡券',
  benefit: '福利', finance: '财务', invoice: '发票', support: '客服', notification: '通知', risk: '风控',
  observability: '可观测性', audit: '审计', extension: '扩展',
});

export interface PermissionGroup {
  readonly category: string;
  readonly label: string;
  readonly permissions: readonly (typeof PERMISSION_CATALOG)[number][];
}

export const PERMISSION_GROUPS: readonly PermissionGroup[] = Object.freeze(
  [...new Set(PERMISSION_CATALOG.map(({ category }) => category))].map((category) => Object.freeze({
    category,
    label: categoryLabels[category] ?? category,
    permissions: PERMISSION_CATALOG.filter((permission) => permission.category === category),
  })),
);

export const PERMISSION_CODES = Object.freeze(PERMISSION_CATALOG.map(({ code }) => code));

export function riskLabel(risk: (typeof PERMISSION_CATALOG)[number]['risk']): string {
  return ({ low: '常规', elevated: '较高', high: '高风险', critical: '关键' } as const)[risk];
}
