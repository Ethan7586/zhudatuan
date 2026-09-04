import { PERMISSION_CATALOG, type PermissionDefinition } from '@shop/authz';
import { permissionText } from './PermissionText';

const categoryNames: Readonly<Record<string, string>> = Object.freeze({
  access: '身份与权限',
  account: '账号',
  audit: '审计',
  benefit: '福利',
  capability: '能力配置',
  cart: '购物车',
  catalog: '商品',
  channel: '渠道',
  checkout: '结算',
  experience: '商城体验',
  extension: '扩展',
  finance: '财务',
  fulfillment: '履约',
  identity: '账号与身份',
  inventory: '库存',
  invoice: '发票',
  marketing: '营销',
  member: '成员',
  navigation: '导航',
  notification: '通知',
  observability: '运行监控',
  order: '订单与售后',
  organization: '组织',
  partner: '合作伙伴',
  payment: '支付',
  pricing: '价格',
  qualification: '员工资格',
  referral: '分销返佣',
  reporting: '经营报表',
  risk: '风险控制',
  runtime: '任务运行',
  support: '客服',
  verification: '核验',
  voucher: '卡券',
});

const synonyms: Readonly<Record<string, string>> = Object.freeze({
  refund: '退款 售后 退钱 返款',
  withdrawal: '提现 出款',
  settlement: '结算 清算',
  voucher: '卡券 礼品卡 福利券',
  credential: '卡密 密钥 凭证',
  order: '订单 交易',
  inventory: '库存 存量 可售量',
  catalog: '商品 产品',
  member: '成员 员工 用户',
  role: '角色 岗位 身份',
  scope: '范围 项目 商城 门店 部门',
  approval: '审批 复核 审核',
});

export interface PermissionGroup {
  readonly category: string;
  readonly name: string;
  readonly permissions: readonly PermissionDefinition[];
}

export function permissionGroups(codes: readonly string[], query: string): readonly PermissionGroup[] {
  const allowed = new Set(codes);
  const normalized = query.trim().toLocaleLowerCase('zh-CN');
  const visible = PERMISSION_CATALOG.filter((permission) => allowed.has(permission.code) && permission.delegatable && matches(permission, normalized));
  const categories = [...new Set(visible.map((permission) => permission.category))];
  return Object.freeze(categories
    .map((category) => Object.freeze({
      category,
      name: categoryNames[category] ?? permissionText(category),
      permissions: Object.freeze(visible.filter((permission) => permission.category === category)),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN')));
}

export function permissionRisk(permission: PermissionDefinition): string {
  if (permission.risk === 'critical') return '关键权限';
  if (permission.risk === 'high') return '高风险';
  if (permission.risk === 'elevated') return '较高风险';
  return '常规权限';
}

export function permissionDefinition(code: string): PermissionDefinition | undefined {
  return PERMISSION_CATALOG.find((permission) => permission.code === code);
}

function matches(permission: PermissionDefinition, query: string): boolean {
  if (!query) return true;
  const parts = permission.code.split('.');
  const extra = parts.map((part) => synonyms[part] ?? '').join(' ');
  const search = `${permissionText(permission.code)} ${permission.code} ${permission.description} ${categoryNames[permission.category] ?? ''} ${extra}`.toLocaleLowerCase('zh-CN');
  return query.split(/\s+/).every((term) => search.includes(term));
}
