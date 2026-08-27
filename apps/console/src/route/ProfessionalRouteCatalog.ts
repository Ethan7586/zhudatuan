import type { OperationId } from '@shop/contract';
import type { IconName } from '../shared/ui/Icon';

export interface ProfessionalRoute {
  readonly featureKey: string;
  readonly suffix: string;
  readonly pattern: RegExp;
  readonly title: string;
  readonly summary: string;
  readonly section: '业务运营' | '财务运营' | '组织设置';
  readonly icon: IconName;
  readonly operation: OperationId | null;
  readonly operations: readonly OperationId[];
  readonly blocker?: string;
}

export const professionalRoutes: readonly ProfessionalRoute[] = Object.freeze([
  route('applications', 'applications', /^applications$/, '商城与应用', '按当前范围管理商城、应用、装修与发布', '业务运营', 'application',
    'experience.applications.read'),
  route('vouchers', 'vouchers', /^vouchers$/, '卡券治理台', '按当前网站范围管理卡券方案、卡号库、备券申请与发行批次', '业务运营', 'voucher',
    'voucher.programs.read', ['voucher.cardlibraries.read', 'voucher.programs.read', 'voucher.reserves.read', 'voucher.batches.read']),
  route('reports', 'reports', /^reports$/, '数据报表', '商品、商城、分类、渠道和卡券投影', '业务运营', 'report',
    'reporting.sales.read', ['reporting.sales.read', 'reporting.products.read', 'reporting.malls.read', 'reporting.categories.read',
      'reporting.channels.read', 'reporting.powderclass.read', 'reporting.voucherconsumption.read']),
  route('support', 'support', /^support(?:\/[^/]+)?$/, '客服中心', '工单、对话、分派和 SLA 状态', '业务运营', 'support',
    'support.cases.read', ['support.cases.read', 'support.messages.read']),
  route('channels', 'channels', /^channels$/, '渠道管理', '连接、同步批次和外部操作回执', '业务运营', 'channel',
    'channel.connections.read', ['channel.connections.read', 'channel.syncruns.read', 'channel.operations.read']),
  route('imports', 'imports/member/:jobId', /^imports\/(?:member|catalog|voucher)\/[^/]+$/, '导入结果',
    '导入进度、错误行和服务端报告', '业务运营', 'import', null,
    ['member.imports.read', 'catalog.imports.read', 'voucher.imports.read']),
  route('entries', 'finance/entries', /^finance\/entries$/, '财务分录', '不可变借贷分录和业务引用', '财务运营', 'finance', 'finance.entries.read'),
  route('statements', 'finance/statements', /^finance\/statements$/, '账单', '服务端生成的期间账单', '财务运营', 'finance',
    'finance.statements.read'),
  route('reconciliations', 'finance/reconciliations', /^finance\/reconciliations$/, '对账', '渠道账单匹配、差异和证据',
    '财务运营', 'finance', 'finance.reconciliations.read'),
  route('settlements', 'finance/settlements', /^finance\/settlements$/, '结算', '冻结结算、分账和调整状态', '财务运营', 'finance',
    'finance.settlements.read'),
  route('withdrawals', 'finance/withdrawals', /^finance\/withdrawals$/, '提现', '提现申请和支付终态', '财务运营', 'finance',
    'finance.withdrawals.read'),
  route('invoices', 'finance/invoices', /^finance\/invoices$/, '发票', '开票申请、金额和文档状态', '财务运营', 'finance',
    'invoice.requests.read'),
  route('access', 'settings/access', /^settings\/access$/, '权限中心', '成员角色、授权范围和 Access Version', '组织设置',
    'access', 'access.center.read'),
  route('members', 'settings/members', /^settings\/members$/, '成员管理', '成员、员工号和入会状态', '组织设置', 'member',
    'member.members.read'),
  route('qualification', 'settings/qualification', /^settings\/qualification$/, '资格管理', '资格策略、版本和发布状态',
    '组织设置', 'qualification', 'qualification.center.read'),
  route('notification', 'settings/notification', /^settings\/notification$/, '通知管理', '模板、公告和发送边界', '组织设置',
    'notification', 'notification.templates.read', ['notification.templates.read', 'notification.announcements.read']),
  route('productdetail', 'products/:productId', /^products\/[^/]+$/, '商品详情', '单商品权威详情', '业务运营', 'product', null, [],
    '缺少 catalog.product.detail.read Operation，页面必须 fail-closed。'),
  route('orderdetail', 'orders/:orderId', /^orders\/[^/]+$/, '订单详情', '订单、支付、履约和售后终态', '业务运营', 'orders',
    'order.orders.read'),
]);

export function professionalRouteFromPath(pathname: string): ProfessionalRoute | undefined {
  const suffix = scopeSuffix(pathname);
  return professionalRoutes.find(({ pattern }) => pattern.test(suffix));
}

export function scopeSuffix(pathname: string): string {
  return pathname.split('/').filter(Boolean).slice(3).join('/');
}

function route(
  featureKey: string,
  suffix: string,
  pattern: RegExp,
  title: string,
  summary: string,
  section: ProfessionalRoute['section'],
  icon: IconName,
  operation: OperationId | null,
  operations: readonly OperationId[] = operation === null ? [] : [operation],
  blocker?: string,
): ProfessionalRoute {
  return Object.freeze({ featureKey, suffix, pattern, title, summary, section, icon, operation,
    operations: Object.freeze([...operations]), ...(blocker === undefined ? {} : { blocker }) });
}
